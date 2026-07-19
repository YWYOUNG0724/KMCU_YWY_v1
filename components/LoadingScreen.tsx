import React, { useEffect, useState } from 'react';
import { Plane } from 'lucide-react';

const messages = [
  "여행 DNA를 분석하고 있습니다...",
  "숨겨진 현지 명소를 찾는 중...",
  "최적의 이동 경로를 계산 중...",
  "예산 범위를 확인하는 중...",
  "완벽한 일정을 마무리하는 중..."
];

const LoadingScreen: React.FC = () => {
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIndex((prev) => (prev + 1) % messages.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="relative w-24 h-24 mb-8">
        <div className="absolute inset-0 bg-blue-100 rounded-full animate-ping opacity-75"></div>
        <div className="relative bg-white p-6 rounded-full shadow-xl border-4 border-blue-50 flex items-center justify-center">
            <Plane className="w-10 h-10 text-blue-600 animate-pulse" />
        </div>
      </div>
      
      <h3 className="text-xl font-bold text-gray-800 mb-2 animate-fade-in">
        {messages[msgIndex]}
      </h3>
      <p className="text-gray-500 text-sm max-w-xs mx-auto break-keep">
        AI가 당신만을 위한 특별한 여행 일정을 만들고 있습니다. 잠시만 기다려주세요.
      </p>
    </div>
  );
};

export default LoadingScreen;