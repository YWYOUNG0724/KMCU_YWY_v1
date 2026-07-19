import React, { useState } from 'react';
import { TripPlan, Activity, UserPreferences } from '../types';
import { Clock, MapPin, DollarSign, RefreshCw, Navigation, Sun, Moon, Utensils, Coffee, Camera, Download, Copy, Github, ExternalLink } from 'lucide-react';
import * as D3 from 'd3';
import { getAlternativeActivity } from '../services/geminiService';

interface ItineraryViewProps {
  plan: TripPlan;
  prefs: UserPreferences;
  githubUser: any;
  onGithubLogin: () => void;
}

const categoryLabels: Record<string, string> = {
  meal: '식사',
  sightseeing: '관광',
  cafe: '카페',
  activity: '액티비티',
  rest: '휴식'
};

// Visual category mapping
const getCategoryIcon = (cat: string) => {
  switch (cat) {
    case 'meal': return <Utensils className="w-4 h-4" />;
    case 'cafe': return <Coffee className="w-4 h-4" />;
    case 'sightseeing': return <Camera className="w-4 h-4" />;
    case 'rest': return <Moon className="w-4 h-4" />;
    default: return <Sun className="w-4 h-4" />;
  }
};

const getCategoryColor = (cat: string) => {
   switch (cat) {
    case 'meal': return 'bg-orange-100 text-orange-600 border-orange-200';
    case 'cafe': return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'sightseeing': return 'bg-blue-100 text-blue-600 border-blue-200';
    case 'rest': return 'bg-purple-100 text-purple-600 border-purple-200';
    default: return 'bg-gray-100 text-gray-600 border-gray-200';
  }
}

const ItineraryView: React.FC<ItineraryViewProps> = ({ plan, prefs, githubUser, onGithubLogin }) => {
  const [selectedDay, setSelectedDay] = useState(1);
  const [currentPlan, setCurrentPlan] = useState<TripPlan>(plan);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [exportingGist, setExportingGist] = useState(false);
  const [gistUrl, setGistUrl] = useState<string | null>(null);
  const [gistError, setGistError] = useState<string | null>(null);

  const activeDay = currentPlan.days.find(d => d.day === selectedDay) || currentPlan.days[0];

  const handleExportGist = async () => {
    if (gistUrl) {
      window.open(gistUrl, '_blank');
      return;
    }

    if (!githubUser) {
      onGithubLogin();
      return;
    }

    setExportingGist(true);
    setGistUrl(null);
    setGistError(null);

    try {
      const markdown = generateFormattedText();
      const response = await fetch('/api/auth/github/create-gist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: currentPlan.tripName,
          content: markdown,
          description: `윤우영의 여행일정 AI로 작성한 여행 계획: ${currentPlan.tripName}`,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'GitHub Gist 생성에 실패했습니다.');
      }

      const data = await response.json();
      setGistUrl(data.html_url);
    } catch (err: any) {
      console.error(err);
      setGistError(err.message || 'Gist 생성 중 오류가 발생했습니다.');
    } finally {
      setExportingGist(false);
    }
  };

  const generateFormattedText = () => {
    let text = `==================================================\n`;
    text += `✈️ 윤우영의 여행일정 AI 여행 계획: ${currentPlan.tripName}\n`;
    text += `==================================================\n\n`;

    text += `■ 여행 정보\n`;
    text += `- 출발지: ${prefs.departure}\n`;
    if (prefs.waypoint) {
      text += `- 경유지: ${prefs.waypoint}\n`;
    }
    text += `- 여행지: ${prefs.destination}\n`;
    text += `- 동행인: ${prefs.companions}\n`;
    text += `- 총 예상 경비: ${currentPlan.totalEstimatedBudget}\n`;
    text += `- 여행 요약: ${currentPlan.summary}\n\n`;

    currentPlan.days.forEach((day) => {
      text += `--------------------------------------------------\n`;
      text += `📅 ${day.day}일차 (테마: ${day.theme})\n`;
      text += `--------------------------------------------------\n`;

      day.activities.forEach((item) => {
        text += `[${item.time}] ${item.placeName} (${categoryLabels[item.category] || item.category})\n`;
        text += `  • 설명: ${item.description}\n`;
        text += `  • 추천 이유: ${item.reason}\n`;
        if (item.estimatedCost) {
          text += `  • 예상 비용: ${item.estimatedCost}\n`;
        }
        text += `  • 위치 팁: ${item.locationHint}\n\n`;
      });
    });

    text += `==================================================\n`;
    text += `윤우영의 여행일정 AI - AI 초개인화 여행 플래너\n`;
    text += `==================================================\n`;
    
    return text;
  };

  const handleDownloadTxt = () => {
    const text = generateFormattedText();
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    const safeTripName = currentPlan.tripName.replace(/[^a-zA-Z0-9가-힣\s]/g, '').trim() || '여행일정';
    link.download = `${safeTripName}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2000);
  };

  const handleCopyClipboard = async () => {
    const text = generateFormattedText();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      alert("클립보드 복사에 실패했습니다. 직접 복사해주세요.");
    }
  };

  const handleReplace = async (activity: Activity) => {
    setLoadingId(activity.id);
    try {
      const newActivity = await getAlternativeActivity(activity, prefs);
      // Update plan structure
      const updatedDays = currentPlan.days.map(day => {
        if (day.day !== selectedDay) return day;
        return {
          ...day,
          activities: day.activities.map(a => a.id === activity.id ? { ...newActivity, id: a.id } : a)
        };
      });
      setCurrentPlan({ ...currentPlan, days: updatedDays });
    } catch (e) {
      alert("현재 대체 장소를 찾을 수 없습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="h-full flex flex-col md:flex-row gap-6 max-w-6xl mx-auto p-4 md:p-6">
      
      {/* Left Panel: Timeline */}
      <div className="flex-1 min-w-0 md:max-w-xl flex flex-col">
        {/* Header */}
        <div className="mb-6 bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 leading-tight mb-2 break-keep">
                {currentPlan.tripName}
            </h1>
            <p className="text-gray-500 text-sm mb-4 leading-relaxed break-keep">{currentPlan.summary}</p>
            
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-4 border-t border-gray-100">
                <div className="flex flex-wrap gap-2 items-center">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <DollarSign className="w-3 h-3 mr-1" /> {currentPlan.totalEstimatedBudget}
                    </span>
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                        {prefs.companions}
                    </span>
                    <div className="flex flex-wrap items-center gap-1 bg-blue-50/50 p-1.5 rounded-xl border border-blue-100/30 text-xs">
                        <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">출발</span>
                        <span className="font-semibold text-gray-700">{prefs.departure}</span>
                        {prefs.waypoint && (
                          <>
                            <span className="text-gray-300 font-bold">→</span>
                            <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[10px]">경유</span>
                            <span className="font-semibold text-gray-700">{prefs.waypoint}</span>
                          </>
                        )}
                        <span className="text-gray-300 font-bold">→</span>
                        <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-bold text-[10px]">도착</span>
                        <span className="font-semibold text-gray-700">{prefs.destination}</span>
                    </div>
                </div>

                <div className="flex flex-col items-end gap-1.5">
                    <div className="flex gap-2">
                        <button
                            onClick={handleDownloadTxt}
                            className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm ${
                                downloaded 
                                ? 'bg-green-600 hover:bg-green-700 text-white' 
                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                            }`}
                            id="btn-download-itinerary"
                        >
                            <Download className="w-3.5 h-3.5" />
                            {downloaded ? '다운로드 완료' : '일정 다운로드'}
                        </button>
                        <button
                            onClick={handleCopyClipboard}
                            className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                                copied 
                                ? 'bg-green-50 border-green-200 text-green-700' 
                                : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-700'
                            }`}
                            id="btn-copy-itinerary"
                        >
                            <Copy className="w-3.5 h-3.5" />
                            {copied ? '복사 완료' : '일정 복사'}
                        </button>
                        <button
                            onClick={handleExportGist}
                            disabled={exportingGist}
                            className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border disabled:opacity-60 ${
                                gistUrl 
                                ? 'bg-emerald-600 hover:bg-emerald-700 border-emerald-600 text-white' 
                                : 'bg-gray-900 hover:bg-gray-800 border-gray-900 text-white'
                            }`}
                            id="btn-gist-itinerary"
                        >
                            <Github className="w-3.5 h-3.5" />
                            {exportingGist ? 'Gist 생성 중...' : gistUrl ? 'Gist 보기' : 'Gist 백업'}
                        </button>
                    </div>
                    {gistError && (
                      <p className="text-[10px] text-red-500 font-medium animate-fade-in">{gistError}</p>
                    )}
                    {gistUrl && (
                      <p className="text-[10px] text-emerald-600 font-semibold animate-fade-in">GitHub Gist에 등록되었습니다! 버튼을 누르면 새 창에서 열립니다.</p>
                    )}
                    {!githubUser && !gistUrl && (
                      <p className="text-[9px] text-gray-400">GitHub 로그인 시 Gist에 일정을 백업할 수 있습니다.</p>
                    )}
                </div>
            </div>
        </div>

        {/* Day Selector */}
        <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide mb-2">
          {currentPlan.days.map((day) => (
            <button
              key={day.day}
              onClick={() => setSelectedDay(day.day)}
              className={`flex-shrink-0 px-6 py-2 rounded-full text-sm font-bold transition-all whitespace-nowrap ${
                selectedDay === day.day
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              {day.day}일차
            </button>
          ))}
        </div>

        {/* Timeline Content */}
        <div className="flex-1 space-y-4 pb-20">
          <div className="px-2 mb-2 text-sm text-gray-500 font-medium uppercase tracking-wider flex justify-between items-center">
             <span>{activeDay.theme}</span>
             <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded">
               {activeDay.activities.length}곳 방문
             </span>
          </div>

          <div className="space-y-4">
            {activeDay.activities.map((item, idx) => (
              <div key={item.id} className="group relative pl-8 before:absolute before:left-3 before:top-8 before:bottom-[-24px] before:w-0.5 before:bg-gray-200 last:before:hidden">
                {/* Timeline Dot */}
                <div className="absolute left-0 top-3 w-6 h-6 rounded-full bg-white border-4 border-blue-100 shadow-sm flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                </div>

                {/* Card */}
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                            {item.time}
                        </span>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border flex items-center gap-1 ${getCategoryColor(item.category)}`}>
                            {getCategoryIcon(item.category)}
                            {categoryLabels[item.category] || item.category}
                        </span>
                    </div>
                    {item.estimatedCost && (
                         <span className="text-xs text-gray-400 font-medium">
                           {item.estimatedCost}
                         </span>
                    )}
                  </div>

                  <h3 className="font-bold text-lg text-gray-800 mb-1 break-keep">{item.placeName}</h3>
                  <p className="text-sm text-gray-600 mb-3 leading-relaxed break-keep">{item.description}</p>

                  <div className="flex items-center gap-4 text-xs text-gray-500 bg-gray-50 p-3 rounded-xl">
                      <div className="flex-1 flex items-start gap-1.5">
                         <div className="mt-0.5 min-w-[14px]">✨</div>
                         <p className="italic text-gray-600 break-keep">"{item.reason}"</p>
                      </div>
                  </div>
                  
                   <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-50">
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                             <MapPin className="w-3 h-3" />
                             {item.locationHint}
                        </div>
                        <div className="flex-1"></div>
                        <button 
                            onClick={() => handleReplace(item)}
                            disabled={loadingId === item.id}
                            className="text-xs font-medium text-gray-400 hover:text-blue-600 flex items-center gap-1 transition-colors px-2 py-1 hover:bg-blue-50 rounded"
                        >
                            {loadingId === item.id ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : (
                                <RefreshCw className="w-3 h-3" />
                            )}
                            다른 추천 받기
                        </button>
                   </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel: Visualization / Route (Desktop) or Tab (Mobile) */}
      <div className="hidden md:flex md:w-80 lg:w-96 flex-col gap-4">
        {/* Route Visualization Card */}
        <div className="bg-gradient-to-br from-gray-900 to-slate-800 rounded-3xl p-6 text-white shadow-xl h-fit sticky top-6">
            <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
                <Navigation className="w-5 h-5 text-blue-400" />
                {selectedDay}일차 동선 미리보기
            </h3>
            
            <div className="space-y-6 relative">
                 {/* Decorative Line */}
                 <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-gray-700/50"></div>

                 {activeDay.activities.map((item, i) => (
                     <div key={i} className="relative pl-6 flex items-center gap-3 group">
                         <div className={`absolute left-0 w-4 h-4 rounded-full border-2 border-slate-800 transition-colors ${i === 0 ? 'bg-green-500' : i === activeDay.activities.length - 1 ? 'bg-red-500' : 'bg-blue-500'}`}></div>
                         <div className="flex-1 py-1">
                             <div className="text-xs font-mono text-gray-400 mb-0.5">{item.time}</div>
                             <div className="text-sm font-medium text-gray-200 group-hover:text-white transition-colors truncate">
                                 {item.placeName}
                             </div>
                         </div>
                     </div>
                 ))}
            </div>

            <div className="mt-8 pt-6 border-t border-gray-700/50">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">일정 밸런스</h4>
                {/* Simple Bar Chart using standard HTML/Tailwind */}
                <div className="flex gap-2 h-20 items-end">
                    {['meal', 'sightseeing', 'rest'].map((cat) => {
                         const count = activeDay.activities.filter(a => a.category === cat).length;
                         const height = Math.max(10, count * 20) + '%';
                         return (
                            <div key={cat} className="flex-1 flex flex-col justify-end items-center gap-1 group">
                                <div 
                                    style={{ height }} 
                                    className={`w-full rounded-t-md opacity-80 group-hover:opacity-100 transition-all ${
                                        cat === 'meal' ? 'bg-orange-500' : cat === 'sightseeing' ? 'bg-blue-500' : 'bg-purple-500'
                                    }`}
                                ></div>
                                <span className="text-[10px] text-gray-400 capitalize">{categoryLabels[cat] || cat}</span>
                            </div>
                         )
                    })}
                </div>
            </div>
        </div>
        
        {/* Dynamic Widget */}
        <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100">
            <div className="flex items-start gap-3">
                <div className="bg-white p-2 rounded-full shadow-sm text-blue-600">
                    <Sun className="w-5 h-5" />
                </div>
                <div>
                    <h4 className="font-bold text-gray-800 text-sm">AI 맞춤 제안</h4>
                    <p className="text-xs text-gray-600 mt-1 leading-relaxed break-keep">
                        비가 온다면 야외 공원 대신 근처의 실내 박물관이나 분위기 좋은 카페를 방문해보세요.
                    </p>
                </div>
            </div>
        </div>
      </div>

    </div>
  );
};

export default ItineraryView;