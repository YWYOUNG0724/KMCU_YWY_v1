import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cookieParser());

// Initialize server-side Gemini API
const getAiClient = () => {
  const key = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!key) {
    throw new Error('GEMINI_API_KEY environment variable is required');
  }
  return new GoogleGenAI({ apiKey: key });
};

// Helper to determine Redirect URI dynamically
const getRedirectUri = (req: express.Request) => {
  const host = req.get('host') || 'localhost:3000';
  const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
  return `${protocol}://${host}/auth/github/callback`;
};

// 1. Get GitHub Auth URL
app.get('/api/auth/github/url', (req, res) => {
  const clientId = (req.query.client_id as string) || process.env.GITHUB_CLIENT_ID;
  const clientSecret = (req.query.client_secret as string) || process.env.GITHUB_CLIENT_SECRET;

  if (!clientId) {
    return res.status(400).json({ error: 'GitHub Client ID가 제공되지 않았습니다.' });
  }

  // Set them in temporary cookies so the callback can retrieve them
  res.cookie('temp_github_client_id', clientId, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: 15 * 60 * 1000, // 15 minutes
  });

  if (clientSecret) {
    res.cookie('temp_github_client_secret', clientSecret, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 15 * 60 * 1000, // 15 minutes
    });
  }

  const redirectUri = getRedirectUri(req);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'read:user gist',
    state: Math.random().toString(36).substring(2, 15),
  });

  const authUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;
  res.json({ url: authUrl });
});

// 2. GitHub OAuth Callback (Popup target)
app.get(['/auth/github/callback', '/auth/github/callback/'], async (req, res) => {
  const { code } = req.query;
  const clientId = req.cookies.temp_github_client_id || process.env.GITHUB_CLIENT_ID;
  const clientSecret = req.cookies.temp_github_client_secret || process.env.GITHUB_CLIENT_SECRET;

  if (!code || !clientId || !clientSecret) {
    return res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_FAILURE', error: 'GitHub Client ID, Client Secret 혹은 인증 코드가 누락되었습니다.' }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Authentication failed. Missing configurations (Client ID/Secret) or auth code. Closing...</p>
        </body>
      </html>
    `);
  }

  try {
    // Exchange code for token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: getRedirectUri(req),
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      throw new Error(tokenData.error_description || tokenData.error);
    }

    const accessToken = tokenData.access_token;
    if (!accessToken) {
      throw new Error('No access token returned from GitHub');
    }

    // Set token in secure cookie for cross-origin iframe context
    res.cookie('github_access_token', accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    // Clear temp cookies
    res.clearCookie('temp_github_client_id', { httpOnly: true, secure: true, sameSite: 'none' });
    res.clearCookie('temp_github_client_secret', { httpOnly: true, secure: true, sameSite: 'none' });

    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>GitHub 연동 성공! 이 창은 자동으로 닫힙니다.</p>
        </body>
      </html>
    `);
  } catch (error: any) {
    console.error('GitHub OAuth callback error:', error);
    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_FAILURE', error: ${JSON.stringify(error.message || error)} }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>GitHub 연동 오류: ${error.message || error}</p>
        </body>
      </html>
    `);
  }
});

// 3. Get Authenticated GitHub User details
app.get('/api/auth/github/me', async (req, res) => {
  const token = req.cookies.github_access_token;
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'User-Agent': 'Travel-Itinerary-AI',
      },
    });

    if (!userRes.ok) {
      throw new Error('Failed to fetch user profile from GitHub');
    }

    const userData = await userRes.json();
    res.json({
      login: userData.login,
      id: userData.id,
      avatar_url: userData.avatar_url,
      name: userData.name || userData.login,
      html_url: userData.html_url,
      bio: userData.bio,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Logout from GitHub
app.post('/api/auth/github/logout', (req, res) => {
  res.clearCookie('github_access_token', {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
  });
  res.json({ success: true });
});

// 5. Create a GitHub Gist with the Itinerary
app.post('/api/auth/github/create-gist', async (req, res) => {
  const token = req.cookies.github_access_token;
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { title, content, description } = req.body;
  if (!title || !content) {
    return res.status(400).json({ error: 'Title and content are required' });
  }

  try {
    const filename = `${title.replace(/[^a-zA-Z0-9ㄱ-ㅎㅏ-ㅣ가-힣_.-]/g, '_') || 'itinerary'}.md`;
    const gistBody = {
      description: description || '윤우영의 여행일정 AI로 작성한 여행 계획표',
      public: false,
      files: {
        [filename]: {
          content: content,
        },
      },
    };

    const gistRes = await fetch('https://api.github.com/gists', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'Travel-Itinerary-AI',
      },
      body: JSON.stringify(gistBody),
    });

    if (!gistRes.ok) {
      const errText = await gistRes.text();
      throw new Error(`Gist creation failed: ${errText}`);
    }

    const gistData = await gistRes.json();
    res.json({
      html_url: gistData.html_url,
      id: gistData.id,
    });
  } catch (error: any) {
    console.error('Gist creation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 6. Proxy Gemini API requests to keep API Key completely secure server-side
app.post('/api/generate-trip-plan', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const ai = getAiClient();
    const systemInstruction = `
You are 윤우영의 여행일정 AI, an elite AI travel planner. Your goal is to create hyper-personalized, realistic, and optimized travel itineraries in Korean.
You must return PURE JSON. Do not use Markdown formatting.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        temperature: 0.7,
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error('Empty response from Gemini API');
    }

    // Parse the JSON to ensure validity before returning to client
    const planJson = JSON.parse(text);
    res.json(planJson);
  } catch (error: any) {
    console.error('Gemini API Proxy Error:', error);
    res.status(500).json({ error: error.message || 'Error occurred during trip plan generation' });
  }
});

// 7. Proxy Alternative Activity Generation
app.post('/api/get-alternative-activity', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const ai = getAiClient();
    const systemInstruction = `
You are 윤우영의 여행일정 AI, an elite AI travel planner. Your goal is to create hyper-personalized, realistic, and optimized travel itineraries in Korean.
You must return PURE JSON. Do not use Markdown formatting.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        temperature: 0.7,
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error('Empty response from Gemini API');
    }

    const activityJson = JSON.parse(text);
    res.json(activityJson);
  } catch (error: any) {
    console.error('Gemini Alternative API Proxy Error:', error);
    res.status(500).json({ error: error.message || 'Error occurred during alternative activity generation' });
  }
});

// Integrate Vite middleware in development or serve static build files in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
