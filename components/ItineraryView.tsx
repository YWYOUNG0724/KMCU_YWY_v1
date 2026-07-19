import React, { useState } from 'react';
import { TripPlan, Activity, UserPreferences } from '../types';
import { Clock, MapPin, DollarSign, RefreshCw, Navigation, Sun, Moon, Utensils, Coffee, Camera, Download, Copy, Edit, Check, X, Sparkles } from 'lucide-react';
import * as D3 from 'd3';
import { getAlternativeActivity, replanTripPlan } from '../services/geminiService';
// @ts-ignore
import html2pdf from 'html2pdf.js';

interface ItineraryViewProps {
  plan: TripPlan;
  prefs: UserPreferences;
  onUpdatePlan?: (plan: TripPlan) => void;
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

const ItineraryView: React.FC<ItineraryViewProps> = ({ plan, prefs, onUpdatePlan }) => {
  const [selectedDay, setSelectedDay] = useState(1);
  const [currentPlan, setCurrentPlan] = useState<TripPlan>(plan);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const [copied, setCopied] = useState(false);

  // New state variables for editing and AI replanning
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Activity>>({});
  const [isEdited, setIsEdited] = useState(false);
  const [isReplanning, setIsReplanning] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const activeDay = currentPlan.days.find(d => d.day === selectedDay) || currentPlan.days[0];



  const handleDownloadPdf = () => {
    setDownloadingPdf(true);
    const safeTripName = currentPlan.tripName.replace(/[^a-zA-Z0-9가-힣\s]/g, '').trim() || '여행일정';

    const element = document.createElement('div');
    element.style.padding = '35px';
    element.style.fontFamily = '"Inter", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
    element.style.color = '#1f2937';
    element.style.backgroundColor = '#ffffff';

    element.innerHTML = `
      <div style="max-width: 800px; margin: 0 auto;">
        <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #2563eb; padding-bottom: 20px;">
          <h1 style="font-size: 26px; font-weight: 800; color: #1e3a8a; margin-bottom: 10px;">${currentPlan.tripName}</h1>
          <p style="font-size: 13px; color: #4b5563; line-height: 1.6; margin: 0; max-width: 600px; margin: 0 auto;">${currentPlan.summary}</p>
        </div>

        <div style="background-color: #f3f4f6; border-radius: 12px; padding: 15px 20px; margin-bottom: 30px; font-size: 13px; display: flex; flex-wrap: wrap; justify-content: space-between; gap: 10px;">
          <div><strong style="color: #1e3a8a;">💰 총 예상 경비:</strong> ${currentPlan.totalEstimatedBudget}</div>
          <div><strong style="color: #1e3a8a;">👥 동행인:</strong> ${prefs.companions}</div>
          <div><strong style="color: #1e3a8a;">🗺️ 경로:</strong> ${prefs.departure} ${prefs.waypoint ? `→ ${prefs.waypoint}` : ''} → ${prefs.destination}</div>
        </div>

        ${currentPlan.days.map(day => `
          <div style="margin-bottom: 30px; page-break-inside: avoid;">
            <h2 style="font-size: 17px; font-weight: 700; color: #1e40af; border-left: 4px solid #2563eb; padding-left: 10px; margin-bottom: 15px; background-color: #f0f6ff; padding-top: 6px; padding-bottom: 6px; border-radius: 0 8px 8px 0;">
              📅 ${day.day}일차 - ${day.theme}
            </h2>
            <div style="display: flex; flex-direction: column; gap: 15px;">
              ${day.activities.map(item => `
                <div style="border: 1px solid #e5e7eb; border-radius: 12px; padding: 15px; background-color: #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 1px dashed #f3f4f6; padding-bottom: 6px;">
                    <span style="font-size: 12px; font-weight: 700; color: #2563eb; background-color: #eff6ff; padding: 2px 8px; border-radius: 6px;">
                      ⏰ ${item.time}
                    </span>
                    <span style="font-size: 11px; font-weight: 700; color: #4b5563; background-color: #f3f4f6; padding: 2px 8px; border-radius: 6px;">
                      ${categoryLabels[item.category] || item.category}
                    </span>
                  </div>
                  <h3 style="font-size: 14px; font-weight: 700; color: #111827; margin: 0 0 6px 0;">${item.placeName}</h3>
                  <p style="font-size: 12px; color: #4b5563; margin: 0 0 10px 0; line-height: 1.5;">${item.description}</p>
                  <div style="font-size: 11px; color: #1e3a8a; background-color: #f0fdf4; border-left: 3px solid #4ade80; padding: 8px 12px; border-radius: 0 8px 8px 0; font-style: italic; margin-bottom: 8px;">
                    💡 "${item.reason}"
                  </div>
                  <div style="font-size: 11px; color: #6b7280; display: flex; justify-content: space-between; gap: 10px;">
                    <span>📍 위치: ${item.locationHint}</span>
                    ${item.estimatedCost ? `<span style="font-weight: 600; color: #059669;">💸 비용: ${item.estimatedCost}</span>` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}

        <div style="text-align: center; font-size: 11px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 15px; margin-top: 30px;">
          윤우영의 여행일정 AI - 초개인화 AI 여행 계획 서비스
        </div>
      </div>
    `;

    const opt = {
      margin:       10,
      filename:     `${safeTripName}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().from(element).set(opt).save().then(() => {
      setDownloadingPdf(false);
      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 2000);
    }).catch((err: any) => {
      console.error(err);
      setDownloadingPdf(false);
      alert('PDF 다운로드 중 오류가 발생했습니다. 다시 시도해주세요.');
    });
  };

  const handleStartEdit = (activity: Activity) => {
    setEditingId(activity.id);
    setEditForm({ ...activity });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleSaveEdit = (id: string) => {
    if (!editForm.placeName?.trim()) {
      alert('장소명을 입력해주세요.');
      return;
    }

    const updatedDays = currentPlan.days.map(day => {
      if (day.day !== selectedDay) return day;
      return {
        ...day,
        activities: day.activities.map(a => a.id === id ? { ...a, ...editForm } as Activity : a)
      };
    });

    const updatedPlan = { ...currentPlan, days: updatedDays };
    setCurrentPlan(updatedPlan);
    setIsEdited(true); // Show "AI Replan" action warning banner
    
    if (onUpdatePlan) {
      onUpdatePlan(updatedPlan);
    }

    setEditingId(null);
    setEditForm({});
  };

  const handleReplanWithAi = async () => {
    setIsReplanning(true);
    try {
      const replanned = await replanTripPlan(currentPlan, prefs);
      setCurrentPlan(replanned);
      setIsEdited(false); // Reset warning banner
      if (onUpdatePlan) {
        onUpdatePlan(replanned);
      }
      alert('수정된 장소들을 반영하여 AI가 최적의 동선으로 여행 일정을 재수정하였습니다!');
    } catch (err: any) {
      console.error(err);
      alert(`AI 재계획 수립 중 오류가 발생했습니다: ${err.message || '알 수 없는 오류'}\n잠시 후 다시 시도해주세요.`);
    } finally {
      setIsReplanning(false);
    }
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
                            onClick={handleDownloadPdf}
                            disabled={downloadingPdf}
                            className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm ${
                                downloaded 
                                ? 'bg-green-600 hover:bg-green-700 text-white' 
                                : 'bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50'
                            }`}
                            id="btn-download-itinerary"
                        >
                            {downloadingPdf ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                                <Download className="w-3.5 h-3.5" />
                            )}
                            {downloadingPdf ? 'PDF 생성 중...' : downloaded ? '다운로드 완료' : '일정 PDF 다운로드'}
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
                    </div>
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

        {/* AI Replan Alert Banner */}
        {isEdited && (
          <div className="mb-4 bg-amber-50 rounded-2xl p-4 border border-amber-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in shadow-sm">
            <div className="flex items-start gap-2.5">
              <span className="bg-amber-100 p-2 rounded-xl text-amber-700 mt-0.5 shrink-0">
                <Sparkles className="w-4 h-4 animate-pulse" />
              </span>
              <div>
                <h4 className="font-bold text-amber-800 text-xs sm:text-sm">일정이 직접 수정되었습니다!</h4>
                <p className="text-[11px] sm:text-xs text-amber-700 mt-0.5 leading-relaxed break-keep">
                  수정된 일정을 바탕으로 AI가 최적의 동선 및 전체 요소를 유기적으로 재수립하고 어울리는 추가 추천 코스를 자동으로 채워넣어 드립니다.
                </p>
              </div>
            </div>
            <button
              onClick={handleReplanWithAi}
              disabled={isReplanning}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold text-white bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 shrink-0 shadow-md shadow-amber-600/10 transition-colors"
            >
              {isReplanning ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              {isReplanning ? 'AI 일정 재구성 중...' : '수정된 일정으로 AI 재계획 시작'}
            </button>
          </div>
        )}

        {/* Timeline Content */}
        <div className="flex-1 space-y-4 pb-20 relative">
          {isReplanning && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-30 flex flex-col items-center justify-center rounded-3xl min-h-[300px]">
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin"></div>
                  <Sparkles className="w-6 h-6 text-amber-500 absolute top-3 left-3 animate-pulse" />
                </div>
                <div className="text-center">
                  <h4 className="font-extrabold text-gray-900 text-sm">AI 여행일정 재수립 중...</h4>
                  <p className="text-xs text-gray-500 mt-1">수정하신 일정을 반영하여 최적의 경로를 다시 설계하고 있습니다.</p>
                </div>
              </div>
            </div>
          )}

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

                {editingId === item.id ? (
                  /* Edit Form */
                  <div className="bg-blue-50/20 rounded-2xl p-4 shadow-sm border border-blue-200 animate-fade-in space-y-3">
                    <div className="flex gap-2">
                      <div className="w-1/4">
                        <label className="text-[10px] font-extrabold text-blue-700 block mb-1">시간</label>
                        <input
                          type="text"
                          value={editForm.time || ''}
                          onChange={(e) => setEditForm({ ...editForm, time: e.target.value })}
                          className="w-full px-2 py-1.5 border border-gray-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white"
                          placeholder="HH:MM"
                        />
                      </div>
                      <div className="w-2/4">
                        <label className="text-[10px] font-extrabold text-blue-700 block mb-1">장소명</label>
                        <input
                          type="text"
                          value={editForm.placeName || ''}
                          onChange={(e) => setEditForm({ ...editForm, placeName: e.target.value })}
                          className="w-full px-2 py-1.5 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white"
                          placeholder="장소명"
                        />
                      </div>
                      <div className="w-1/4">
                        <label className="text-[10px] font-extrabold text-blue-700 block mb-1">카테고리</label>
                        <select
                          value={editForm.category || 'sightseeing'}
                          onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                          className="w-full px-2 py-1.5 border border-gray-200 rounded-xl text-xs font-semibold bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                        >
                          {Object.entries(categoryLabels).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-extrabold text-blue-700 block mb-1">설명</label>
                      <textarea
                        value={editForm.description || ''}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                        rows={2}
                        className="w-full px-2.5 py-1.5 border border-gray-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none leading-normal bg-white"
                        placeholder="장소에 대한 간단한 설명을 입력하세요."
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-extrabold text-blue-700 block mb-1">추천 이유 / 꿀팁</label>
                      <textarea
                        value={editForm.reason || ''}
                        onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })}
                        rows={2}
                        className="w-full px-2.5 py-1.5 border border-gray-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none leading-normal bg-white"
                        placeholder="이 일정을 추천하는 이유나 팁을 입력하세요."
                      />
                    </div>

                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="text-[10px] font-extrabold text-blue-700 block mb-1">위치 팁</label>
                        <input
                          type="text"
                          value={editForm.locationHint || ''}
                          onChange={(e) => setEditForm({ ...editForm, locationHint: e.target.value })}
                          className="w-full px-2 py-1.5 border border-gray-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white"
                          placeholder="상세 주소 또는 위치 설명"
                        />
                      </div>
                      <div className="w-1/3">
                        <label className="text-[10px] font-extrabold text-blue-700 block mb-1">예상 비용</label>
                        <input
                          type="text"
                          value={editForm.estimatedCost || ''}
                          onChange={(e) => setEditForm({ ...editForm, estimatedCost: e.target.value })}
                          className="w-full px-2 py-1.5 border border-gray-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white"
                          placeholder="비용 (예: 무료)"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-1.5 pt-1">
                      <button
                        onClick={handleCancelEdit}
                        className="px-3 py-1.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-xs font-bold text-gray-500 transition-colors bg-white"
                      >
                        취소
                      </button>
                      <button
                        onClick={() => handleSaveEdit(item.id)}
                        className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white transition-colors shadow-sm"
                      >
                        저장
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Card */
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
                              onClick={() => handleStartEdit(item)}
                              className="text-xs font-medium text-gray-400 hover:text-blue-600 flex items-center gap-1 transition-colors px-2 py-1 hover:bg-blue-50 rounded"
                          >
                              <Edit className="w-3 h-3" />
                              수정
                          </button>
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
                )}
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