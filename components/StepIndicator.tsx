import React from 'react';

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep, totalSteps }) => {
  return (
    <div className="flex gap-2 mb-8">
      {Array.from({ length: totalSteps }).map((_, idx) => (
        <div
          key={idx}
          className={`h-2 rounded-full transition-all duration-300 ${
            idx < currentStep ? 'w-8 bg-blue-600' : 'w-2 bg-blue-200'
          }`}
        />
      ))}
    </div>
  );
};

export default StepIndicator;
