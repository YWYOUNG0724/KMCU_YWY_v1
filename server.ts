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
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

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
      model: 'gemini-3.5-flash',
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

// 6.5. Replan Trip based on user edits
app.post('/api/replan-trip', async (req, res) => {
  try {
    const { currentPlan, prefs } = req.body;
    if (!currentPlan || !prefs) {
      return res.status(400).json({ error: 'currentPlan and prefs are required' });
    }

    const prompt = `
      Create a ${prefs.duration}-day trip itinerary starting from departure city "${prefs.departure}", ${prefs.waypoint ? `stopping at or passing through layover/waypoint "${prefs.waypoint}",` : ''} and spending most of the time at destination city "${prefs.destination}".
      The output language must be KOREAN (Hangul).
      
      The user has already modified their travel itinerary. Your absolute highest priority is to PRESERVE and incorporate their modifications, custom places, specific times, or descriptions that are present in this draft, and logically build/replan the rest of the travel itinerary around them.
      
      [Current Modified Itinerary Draft]
      Trip Name: ${currentPlan.tripName}
      Summary: ${currentPlan.summary}
      Total Estimated Budget: ${currentPlan.totalEstimatedBudget}
      Days and activities:
      ${JSON.stringify(currentPlan.days, null, 2)}

      Context:
      - Departure city: ${prefs.departure}
      ${prefs.waypoint ? `- Layover / Waypoint: ${prefs.waypoint}` : ''}
      - Destination city: ${prefs.destination}
      - Companions: ${prefs.companions}
      - Budget Level (1-5, 5 is luxury): ${prefs.budgetLevel}
      - Target Budget (per person): ${prefs.budgetAmount}
      - Themes: ${prefs.themes.join(", ")}

      Requirements:
      1. Review the provided draft. Make sure that any edits made by the user (places, times, or custom descriptions) are strictly kept.
      2. If the user changed the placeName, description, time, or other fields, keep them. Do not overwrite or delete those edited activities.
      3. For any other slots or days, make sure the itinerary flows logically and efficiently (minimal travel time between spots, starting from ${prefs.departure}, incorporating ${prefs.waypoint || 'no waypoint'} as appropriate, and exploring ${prefs.destination}).
      4. Provide specific "reasons" for recommendations in Korean, explaining why they are recommended.
      5. Include estimated costs in Korean Won (KRW) or appropriate local currency formatted in Korean.
      6. Categorize activities strictly as one of: 'meal', 'sightseeing', 'cafe', 'activity', or 'rest'.
      7. Return pure valid JSON matching the schema. Do not include markdown formatting.

      Response Format (JSON Schema):
      {
        "tripName": "Creative Trip Title in Korean",
        "summary": "A short engaging summary of the trip concept in Korean.",
        "totalEstimatedBudget": "Total estimated cost string in Korean",
        "days": [
          {
            "day": 1,
            "theme": "Theme title for the day in Korean",
            "activities": [
              {
                "id": "unique_id",
                "time": "HH:MM",
                "placeName": "Name of place in Korean",
                "description": "Short description in Korean",
                "category": "strictly 'meal' | 'sightseeing' | 'cafe' | 'activity' | 'rest'",
                "estimatedCost": "Cost string in Korean",
                "reason": "Why this fits the user (in Korean)",
                "locationHint": "District or area name in Korean"
              }
            ]
          }
        ]
      }
    `;

    const ai = getAiClient();
    const systemInstruction = `
You are 윤우영의 여행일정 AI, an elite AI travel planner. Your goal is to create hyper-personalized, realistic, and optimized travel itineraries in Korean based on the user's modifications.
You must return PURE JSON. Do not use Markdown formatting.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
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

    const planJson = JSON.parse(text);
    res.json(planJson);
  } catch (error: any) {
    console.error('Gemini API Replan Error:', error);
    res.status(500).json({ error: error.message || 'Error occurred during trip plan replanning' });
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
      model: 'gemini-3.5-flash',
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

// 8. PWA manifest and Service Worker endpoints
app.get('/manifest.json', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'manifest.json'));
});

app.get('/sw.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.sendFile(path.join(process.cwd(), 'sw.js'));
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
