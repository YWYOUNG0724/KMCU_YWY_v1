import React, { useState, useEffect } from 'react';
import Onboarding from './components/Onboarding';
import ItineraryView from './components/ItineraryView';
import LoadingScreen from './components/LoadingScreen';
import { generateTripPlan } from './services/geminiService';
import { UserPreferences, TripPlan } from './types';
import { Luggage, Github, X, Copy, Check, Key, ExternalLink } from 'lucide-react';

interface GitHubUser {
  login: string;
  avatar_url: string;
  name: string;
  html_url: string;
}

const App: React.FC = () => {
  const [view, setView] = useState<'onboarding' | 'loading' | 'itinerary'>('onboarding');
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [tripPlan, setTripPlan] = useState<TripPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [githubUser, setGithubUser] = useState<GitHubUser | null>(null);

  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [clientIdInput, setClientIdInput] = useState('');
  const [clientSecretInput, setClientSecretInput] = useState('');
  const [copiedRedirectUri, setCopiedRedirectUri] = useState(false);

  useEffect(() => {
    setClientIdInput(localStorage.getItem('github_client_id') || '');
    setClientSecretInput(localStorage.getItem('github_client_secret') || '');
  }, []);

  const fetchGithubUser = async () => {
    try {
      const res = await fetch('/api/auth/github/me');
      if (res.ok) {
        const data = await res.json();
        setGithubUser(data);
      } else {
        setGithubUser(null);
      }
    } catch (err) {
      setGithubUser(null);
    }
  };

  useEffect(() => {
    fetchGithubUser();
  }, []);

  const handleGithubLogin = async (cid?: string, cs?: string) => {
    const finalCId = cid || clientIdInput || localStorage.getItem('github_client_id');
    const finalCS = cs || clientSecretInput || localStorage.getItem('github_client_secret');

    if (!finalCId || !finalCS) {
      setShowCredentialsModal(true);
      return;
    }

    try {
      const params = new URLSearchParams();
      if (finalCId) params.append('client_id', finalCId);
      if (finalCS) params.append('client_secret', finalCS);

      const res = await fetch(`/api/auth/github/url?${params.toString()}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to fetch auth URL');
      }
      const { url } = await res.json();
      
      const popup = window.open(url, 'github_oauth_popup', 'width=600,height=700');
      if (!popup) {
        alert('팝업 차단이 설정되어 있습니다. 팝업 허용 후 다시 시도해주세요.');
      }
    } catch (err: any) {
      console.error(err);
      alert(`GitHub 로그인 URL을 가져오는 중 오류가 발생했습니다: ${err.message}`);
    }
  };

  const handleGithubLogout = async () => {
    try {
      await fetch('/api/auth/github/logout', { method: 'POST' });
      setGithubUser(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveCredentials = () => {
    if (!clientIdInput.trim() || !clientSecretInput.trim()) {
      alert('Client ID와 Client Secret을 모두 입력해주세요.');
      return;
    }
    localStorage.setItem('github_client_id', clientIdInput.trim());
    localStorage.setItem('github_client_secret', clientSecretInput.trim());
    setShowCredentialsModal(false);
    handleGithubLogin(clientIdInput.trim(), clientSecretInput.trim());
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost') && !origin.includes('127.0.0.1')) {
        return;
      }
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        fetchGithubUser();
      } else if (event.data?.type === 'OAUTH_AUTH_FAILURE') {
        alert(`GitHub 연동에 실패했습니다: ${event.data.error || '알 수 없는 오류'}`);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handlePreferencesComplete = async (prefs: UserPreferences) => {
    setPreferences(prefs);
    setView('loading');
    setError(null);

    try {
      const plan = await generateTripPlan(prefs);
      setTripPlan(plan);
      setView('itinerary');
    } catch (err) {
      console.error(err);
      setError("여행 계획을 생성하는 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.");
      setView('onboarding');
    }
  };

  const handleRestart = () => {
    setPreferences(null);
    setTripPlan(null);
    setView('onboarding');
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 font-sans text-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={handleRestart}>
            <div className="bg-blue-600 text-white p-1.5 rounded-lg">
                <Luggage className="w-5 h-5" />
            </div>
            <span className="text-lg md:text-xl font-extrabold tracking-tight text-gray-900">
              윤우영의 <span className="text-blue-600">여행일정 AI</span>
            </span>
          </div>
          
          <div className="flex items-center gap-4">
            {githubUser ? (
              <div className="flex items-center gap-3 bg-gray-50 border border-gray-200/80 p-1.5 pr-3 rounded-2xl">
                <a href={githubUser.html_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                  <img src={githubUser.avatar_url} alt={githubUser.name} className="w-7 h-7 rounded-full border border-gray-200 shadow-sm" />
                  <span className="text-xs font-bold text-gray-700">{githubUser.name}</span>
                </a>
                <span className="text-gray-300">|</span>
                <button 
                  onClick={handleGithubLogout}
                  className="text-[10px] text-red-500 hover:text-red-600 font-bold transition-colors"
                >
                  로그아웃
                </button>
              </div>
            ) : (
              <button
                onClick={handleGithubLogin}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 hover:text-gray-900 text-xs font-bold text-gray-700 transition-all shadow-sm"
              >
                <Github className="w-3.5 h-3.5 text-gray-700 animate-pulse" />
                <span>GitHub 연동</span>
              </button>
            )}

            {view === 'itinerary' && (
               <button 
                  onClick={handleRestart}
                  className="text-sm font-bold text-gray-500 hover:text-blue-600 transition-colors"
               >
                  새로운 여행
               </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-6 flex-grow">
        {error && (
            <div className="max-w-md mx-auto mb-6 p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 text-sm text-center">
                {error}
            </div>
        )}

        {view === 'onboarding' && (
          <Onboarding onComplete={handlePreferencesComplete} />
        )}

        {view === 'loading' && (
          <LoadingScreen />
        )}

        {view === 'itinerary' && tripPlan && preferences && (
          <ItineraryView 
            plan={tripPlan} 
            prefs={preferences} 
            githubUser={githubUser}
            onGithubLogin={handleGithubLogin}
          />
        )}
      </main>

      {/* Footer with GitHub link */}
      <footer className="mt-auto py-8 border-t border-gray-200/60 bg-white">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-700">윤우영의 여행일정 AI</span>
            <span className="text-gray-300">|</span>
            <span>AI 초개인화 여행 플래너</span>
          </div>
          <a
            href="https://github.com/YWYOUNG0724/KMCU_YWY_BACKUP.git"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 hover:text-gray-900 font-medium transition-all text-xs tracking-wide"
          >
            <Github className="w-4 h-4 text-gray-700" />
            <span>KMCU_YWY_BACKUP</span>
          </a>
        </div>
      </footer>

      {/* GitHub Credentials Modal */}
      {showCredentialsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-2xl max-w-lg w-full overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="bg-gray-50/50 px-6 py-4 border-b border-gray-100/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Github className="w-5 h-5 text-gray-800" />
                <span className="font-extrabold text-gray-900 tracking-tight">GitHub OAuth 연동 설정</span>
              </div>
              <button 
                onClick={() => setShowCredentialsModal(false)}
                className="p-1 rounded-lg hover:bg-gray-200/50 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5 text-sm text-gray-600">
              <div className="bg-blue-50/40 p-4 rounded-2xl border border-blue-100/40 text-xs leading-relaxed space-y-2">
                <p className="font-bold text-blue-800 flex items-center gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5" /> GitHub OAuth App 연동 가이드
                </p>
                <ol className="list-decimal list-inside space-y-1 text-blue-700/90 font-medium">
                  <li>GitHub 프로필 &gt; <strong>Settings &gt; Developer settings &gt; OAuth Apps &gt; New OAuth App</strong>으로 이동합니다.</li>
                  <li><strong>Authorization callback URL</strong>에 아래 주소를 복사하여 정확히 입력해주세요:</li>
                </ol>
                <div className="flex items-center gap-1.5 mt-2 bg-white p-2 rounded-xl border border-blue-100/60 shadow-sm">
                  <code className="text-[10px] font-mono font-extrabold text-blue-600 select-all break-all flex-1">
                    {window.location.origin}/auth/github/callback
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/auth/github/callback`);
                      setCopiedRedirectUri(true);
                      setTimeout(() => setCopiedRedirectUri(false), 2000);
                    }}
                    className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500 transition-colors flex shrink-0"
                  >
                    {copiedRedirectUri ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Client ID */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-gray-700 block flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-blue-500"></span>
                  Client ID <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3.5 text-gray-400"><Key className="w-4 h-4" /></span>
                  <input
                    type="text"
                    value={clientIdInput}
                    onChange={(e) => setClientIdInput(e.target.value)}
                    placeholder="발급받은 OAuth App Client ID를 입력하세요"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm font-semibold transition-all shadow-sm bg-gray-50/10 placeholder-gray-400"
                  />
                </div>
              </div>

              {/* Client Secret */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-gray-700 block flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-blue-500"></span>
                  Client Secret <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3.5 text-gray-400"><Key className="w-4 h-4" /></span>
                  <input
                    type="password"
                    value={clientSecretInput}
                    onChange={(e) => setClientSecretInput(e.target.value)}
                    placeholder="발급받은 Client Secret을 입력하세요"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm font-semibold transition-all shadow-sm bg-gray-50/10 placeholder-gray-400"
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCredentialsModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-500 hover:text-gray-700 bg-white border border-gray-200 transition-colors shadow-sm"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSaveCredentials}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-md shadow-blue-500/10"
              >
                저장 및 연동 시작
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;