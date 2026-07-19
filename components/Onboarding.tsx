import React, { useState } from 'react';
import { UserPreferences, TravelTheme, CompanionType } from '../types';
import StepIndicator from './StepIndicator';
import { MapPin, Calendar, Users, Wallet, Heart, ArrowRight, Check, Compass, PlaneTakeoff } from 'lucide-react';

interface OnboardingProps {
  onComplete: (prefs: UserPreferences) => void;
}

const formatKoreanAmount = (num: number): string => {
  if (num === 0) return '0원';
  
  const formatted = num.toLocaleString('ko-KR');
  
  if (num >= 10000) {
    const man = Math.floor(num / 10000);
    const remain = num % 10000;
    if (remain > 0) {
      return `${man}만 ${remain.toLocaleString('ko-KR')}원`;
    }
    return `${man}만 원`;
  }
  
  return `${formatted}원`;
};

const getBudgetLevel = (amount: number): number => {
  if (amount < 200000) return 1;
  if (amount < 500000) return 2;
  if (amount < 1000000) return 3;
  if (amount < 2000000) return 4;
  return 5;
};

const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [departure, setDeparture] = useState('');
  const [waypoint, setWaypoint] = useState('');
  const [destination, setDestination] = useState('');
  const [duration, setDuration] = useState(2);
  const [budgetAmount, setBudgetAmount] = useState<number>(500000);
  const [companions, setCompanions] = useState<CompanionType>(CompanionType.COUPLE);
  const [themes, setThemes] = useState<TravelTheme[]>([]);

  const toggleTheme = (theme: TravelTheme) => {
    if (themes.includes(theme)) {
      setThemes(themes.filter(t => t !== theme));
    } else {
      if (themes.length < 3) {
        setThemes([...themes, theme]);
      }
    }
  };

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
    else {
      onComplete({
        departure: departure || '서울',
        waypoint: waypoint || undefined,
        destination: destination || '부산', // Default fallback
        duration,
        budgetLevel: getBudgetLevel(budgetAmount),
        budgetAmount: formatKoreanAmount(budgetAmount),
        companions,
        themes: themes.length > 0 ? themes : [TravelTheme.HEALING],
      });
    }
  };

  const isStepValid = () => {
    if (step === 1) return departure.trim().length > 0 && destination.trim().length > 0;
    if (step === 2) return budgetAmount > 0;
    if (step === 3) return themes.length > 0;
    return false;
  };

  return (
    <div className="max-w-xl mx-auto px-6 py-8">
      <StepIndicator currentStep={step} totalSteps={3} />

      {step === 1 && (
        <div className="animate-fade-in-up">
          <h2 className="text-3xl font-bold text-gray-800 mb-2">어디로 떠나시나요?</h2>
          <p className="text-gray-500 mb-8">출발지, 경유지, 여행지와 일정을 입력해주세요.</p>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                출발지 <span className="text-red-500 font-bold">*</span>
              </label>
              <div className="relative">
                <PlaneTakeoff className="absolute left-4 top-3.5 text-emerald-500 w-5 h-5" />
                <input
                  type="text"
                  value={departure}
                  onChange={(e) => setDeparture(e.target.value)}
                  placeholder="예: 서울, 인천공항, 김포공항"
                  className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all shadow-sm animate-fade-in"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5 justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                  경유지
                </div>
                <span className="text-xs text-gray-400 font-normal">선택 사항 / 생략 가능</span>
              </label>
              <div className="relative">
                <Compass className="absolute left-4 top-3.5 text-amber-500 w-5 h-5" />
                <input
                  type="text"
                  value={waypoint}
                  onChange={(e) => setWaypoint(e.target.value)}
                  placeholder="예: 대전, 싱가포르, 도쿄 (생략 가능)"
                  className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all shadow-sm animate-fade-in"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                여행지 <span className="text-red-500 font-bold">*</span>
              </label>
              <div className="relative">
                <MapPin className="absolute left-4 top-3.5 text-blue-500 w-5 h-5" />
                <input
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="예: 부산, 제주도, 오사카, 파리"
                  className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all shadow-sm animate-fade-in"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">여행 기간 (일)</label>
              <div className="flex items-center gap-4 bg-white p-2 rounded-xl border border-gray-200 shadow-sm">
                <button
                  onClick={() => setDuration(Math.max(1, duration - 1))}
                  className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-gray-200 text-lg font-bold"
                >
                  -
                </button>
                <div className="flex-1 text-center font-semibold text-gray-800 flex items-center justify-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-500" />
                  {duration}일
                </div>
                <button
                  onClick={() => setDuration(Math.min(14, duration + 1))}
                  className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center hover:bg-blue-200 text-lg font-bold"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="animate-fade-in-up">
          <h2 className="text-3xl font-bold text-gray-800 mb-2">누구와 함께, 어떻게?</h2>
          <p className="text-gray-500 mb-8">동행인과 예산을 알려주세요.</p>

          <div className="space-y-8">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">동행인</label>
              <div className="grid grid-cols-2 gap-3">
                {Object.values(CompanionType).map((type) => (
                  <button
                    key={type}
                    onClick={() => setCompanions(type)}
                    className={`p-3 rounded-xl border flex items-center gap-2 transition-all ${
                      companions === type
                        ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-md ring-1 ring-blue-500'
                        : 'border-gray-200 bg-white hover:border-blue-300 text-gray-600'
                    }`}
                  >
                    <Users className={`w-4 h-4 ${companions === type ? 'text-blue-500' : 'text-gray-400'}`} />
                    <span className="font-medium">{type}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                  1인당 여행 예산 <span className="text-red-500 font-bold">*</span>
                </div>
                {budgetAmount > 0 && (
                  <span className="text-xs text-blue-600 font-bold bg-blue-50 px-2.5 py-1 rounded-md animate-fade-in border border-blue-100/50">
                    {formatKoreanAmount(budgetAmount)}
                  </span>
                )}
              </label>

              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-5">
                {/* Text input with custom design */}
                <div className="relative">
                  <div className="absolute left-4 top-3 bg-blue-50/50 p-1.5 rounded-lg text-blue-600 border border-blue-100/30">
                    <Wallet className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    pattern="[0-9]*"
                    inputMode="numeric"
                    value={budgetAmount === 0 ? '' : budgetAmount.toLocaleString('ko-KR')}
                    onChange={(e) => {
                      const cleanVal = e.target.value.replace(/[^0-9]/g, '');
                      const parsed = cleanVal ? parseInt(cleanVal, 10) : 0;
                      if (parsed <= 100000000) { // Limit to 100 million won for safety
                        setBudgetAmount(parsed);
                      }
                    }}
                    placeholder="예산 금액을 입력하세요"
                    className="w-full pl-14 pr-12 py-3 text-lg font-bold text-gray-800 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all shadow-inner bg-gray-50/20"
                  />
                  <span className="absolute right-4 top-3.5 text-gray-500 font-bold text-sm">원</span>
                </div>

                {/* Preset quick buttons */}
                <div className="space-y-2">
                  <span className="text-xs text-gray-400 font-medium block">빠른 선택</span>
                  <div className="grid grid-cols-4 gap-2">
                    {[300000, 500000, 1000000, 2000000].map((amount) => (
                      <button
                        key={amount}
                        type="button"
                        onClick={() => setBudgetAmount(amount)}
                        className={`py-2 px-1 rounded-xl text-xs font-bold border transition-all ${
                          budgetAmount === amount
                            ? 'bg-blue-600 border-blue-600 text-white shadow-md'
                            : 'bg-gray-50 border-gray-200/60 hover:bg-gray-100 text-gray-600'
                        }`}
                      >
                        {amount >= 1000000 ? `${amount / 1000000}00만` : `${amount / 10000}만`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Adjust increment buttons */}
                <div className="space-y-2 pt-1 border-t border-gray-50">
                  <span className="text-xs text-gray-400 font-medium block">금액 조정</span>
                  <div className="flex gap-2">
                    {[100000, 500000].map((increment) => (
                      <button
                        key={increment}
                        type="button"
                        onClick={() => setBudgetAmount((prev) => Math.min(100000000, prev + increment))}
                        className="flex-1 py-2 rounded-xl text-xs font-bold bg-white border border-gray-200 hover:bg-gray-50 text-blue-600 transition-colors shadow-sm"
                      >
                        +{increment >= 1000000 ? `${increment / 1000000}00만` : `${increment / 10000}만`}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setBudgetAmount(0)}
                      className="py-2 px-4 rounded-xl text-xs font-bold bg-red-50 border border-red-100 hover:bg-red-100 text-red-600 transition-colors"
                    >
                      초기화
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="animate-fade-in-up">
          <h2 className="text-3xl font-bold text-gray-800 mb-2">나의 여행 DNA</h2>
          <p className="text-gray-500 mb-8">원하는 여행 테마를 최대 3개 선택해주세요.</p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Object.values(TravelTheme).map((theme) => {
              const isSelected = themes.includes(theme);
              return (
                <button
                  key={theme}
                  onClick={() => toggleTheme(theme)}
                  className={`relative p-4 rounded-2xl border transition-all h-28 flex flex-col items-center justify-center gap-2 text-center ${
                    isSelected
                      ? 'border-blue-500 bg-blue-600 text-white shadow-lg transform scale-105'
                      : 'border-gray-200 bg-white hover:border-blue-300 text-gray-600 hover:shadow-md'
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-2 right-2 bg-white text-blue-600 rounded-full p-0.5">
                      <Check className="w-3 h-3" />
                    </div>
                  )}
                  <Heart className={`w-6 h-6 ${isSelected ? 'fill-current' : 'text-gray-400'}`} />
                  <span className="font-semibold text-sm">{theme}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-10">
        <button
          onClick={handleNext}
          disabled={!isStepValid()}
          className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-lg ${
            isStepValid()
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-xl transform hover:-translate-y-1'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          {step === 3 ? '여행 계획 생성하기' : '다음 단계'}
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default Onboarding;