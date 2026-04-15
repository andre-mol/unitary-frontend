import React, { useState } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: React.ReactNode;
  error?: string | boolean;
}

export const Input: React.FC<InputProps> = ({ label, icon, error, className = '', ...props }) => {
  const [isFocused, setIsFocused] = useState(false);
  const hasError = !!error;

  return (
    <div className={`relative group ${className}`}>
      {label && (
        <label className={`block text-xs font-medium mb-1.5 ml-1 transition-colors duration-300 ${
          hasError ? 'text-red-400' : 'text-zinc-400 group-focus-within:text-amber-500'
        }`}>
          {label}
        </label>
      )}
      
      <div className="relative">
        {/* Icon Wrapper */}
        {icon && (
          <div className={`absolute left-3 top-1/2 -translate-y-1/2 transition-colors duration-300 ${isFocused ? 'text-amber-500' : 'text-zinc-500'}`}>
            {icon}
          </div>
        )}

        {/* Input Field */}
        <input
          {...props}
          onFocus={(e) => {
            setIsFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            props.onBlur?.(e);
          }}
          className={`
            w-full bg-zinc-900/50 text-white placeholder-zinc-600 
            border ${hasError ? 'border-red-500' : 'border-zinc-800'} rounded-lg 
            py-3 ${icon ? 'pl-10' : 'pl-4'} pr-4
            focus:outline-none focus:bg-zinc-900
            transition-all duration-300 ease-out
            ${isFocused && !hasError ? 'shadow-[0_0_15px_rgba(245,158,11,0.1)]' : ''}
            ${hasError ? 'shadow-[0_0_15px_rgba(239,68,68,0.1)]' : ''}
            ${className}
          `}
        />

        {/* Animated Bottom Border / Glow Ring */}
        <div className={`absolute inset-0 rounded-lg pointer-events-none transition-all duration-500 ease-out border ${
          hasError ? 'border-red-500/50' : isFocused ? 'border-amber-500/50' : 'border-transparent'
        }`} />
        
        {/* Bottom expanding line */}
        <div 
            className={`absolute bottom-0 left-1/2 -translate-x-1/2 h-[2px] ${
              hasError ? 'bg-red-500' : 'bg-amber-500'
            } transition-all duration-300 ease-out ${isFocused || hasError ? 'w-full opacity-100' : 'w-0 opacity-0'}`}
        />
      </div>
      {error && typeof error === 'string' && (
        <p className="mt-1.5 text-xs text-red-400 ml-1">{error}</p>
      )}
    </div>
  );
};