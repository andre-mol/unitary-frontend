
import React from 'react';

export const StepIndicator: React.FC<{ currentStep: number; totalSteps: number }> = ({ currentStep, totalSteps }) => {
  return (
    <div className="flex justify-center items-center gap-2 mb-8">
      {Array.from({ length: totalSteps }).map((_, idx) => {
        const stepNum = idx + 1;
        const isActive = stepNum === currentStep;
        const isCompleted = stepNum < currentStep;

        return (
          <div key={idx} className="flex items-center">
            <div 
              className={`h-2 w-12 rounded-full transition-all duration-500 ${
                isActive ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 
                isCompleted ? 'bg-amber-900/40' : 'bg-zinc-800'
              }`}
            />
          </div>
        );
      })}
    </div>
  );
};
