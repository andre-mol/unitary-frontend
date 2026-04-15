import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({ 
  variant = 'primary', 
  size = 'md', 
  className = '', 
  children, 
  disabled,
  onClick,
  ...props 
}) => {
  const isDisabled = !!disabled;
  const baseStyles = "relative inline-flex items-center justify-center font-medium transition-all duration-300 ease-out rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-950 transform-gpu overflow-hidden group";
  
  const variants = {
    primary: "bg-amber-500 text-black shadow-[0_0_15px_rgba(245,158,11,0.3)] hover:bg-amber-400 hover:shadow-[0_0_30px_rgba(245,158,11,0.6)] hover:-translate-y-0.5 focus:ring-amber-500",
    secondary: "bg-zinc-800 hover:bg-zinc-700 text-white hover:text-white shadow-lg hover:shadow-zinc-900/50 focus:ring-zinc-500",
    outline: "border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white bg-transparent hover:bg-zinc-800/30 focus:ring-zinc-500"
  };

  const sizes = {
    sm: "px-4 py-2 text-sm",
    md: "px-6 py-3 text-base",
    lg: "px-8 py-4 text-lg"
  };

  const disabledStyles = isDisabled
    ? "pointer-events-none cursor-not-allowed opacity-60 shadow-none hover:translate-y-0 hover:bg-inherit hover:shadow-none"
    : "active:scale-95";

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${disabledStyles} ${className}`}
      disabled={disabled}
      onClick={isDisabled ? undefined : onClick}
      {...props}
    >
      {/* Subtle Shine Effect for Primary Buttons */}
      {variant === 'primary' && !isDisabled && (
        <span className="absolute inset-0 flex h-full w-full justify-center [transform:skew(-12deg)_translateX(-100%)] group-hover:duration-1000 group-hover:[transform:skew(-12deg)_translateX(100%)]">
          <span className="relative h-full w-8 bg-white/20"></span>
        </span>
      )}
      <span className="relative flex items-center">{children}</span>
    </button>
  );
};
