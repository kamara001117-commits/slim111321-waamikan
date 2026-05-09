import React from 'react';

const Logo = ({ className = "h-14", dark = false, showText = true }: { className?: string; dark?: boolean; showText?: boolean }) => (
  <div className={`flex items-center gap-3 ${className}`}>
    <div className="h-full aspect-square relative flex items-center justify-center">
      {/* Precision Medical Symbol */}
      <svg 
        viewBox="0 0 100 100" 
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-auto"
      >
        <circle 
          cx="50" 
          cy="50" 
          r="46" 
          fill="none" 
          stroke={dark ? "rgba(255,255,255,0.2)" : "rgba(11, 60, 93, 0.1)"} 
          strokeWidth="2"
        />
        <circle 
          cx="50" 
          cy="50" 
          r="40" 
          fill={dark ? "rgba(255,255,255,0.05)" : "white"} 
          className="shadow-inner"
        />
        {/* Stylized 'W' & Imaging Beam */}
        <path 
          d="M25 40L40 70L50 50L60 70L75 40" 
          stroke="#0B3C5D" 
          strokeWidth="8" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          className={dark ? "stroke-white" : "stroke-[#0B3C5D]"}
        />
        <path 
          d="M40 70L50 50L60 70" 
          stroke="#EAB308" 
          strokeWidth="8" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
        />
        <circle 
          cx="50" 
          cy="50" 
          r="4" 
          fill="#EAB308" 
        />
      </svg>
    </div>
    
    {showText && (
      <div className={`flex flex-col ${dark ? 'text-white' : 'text-[#0B3C5D]'} font-sans leading-none`}>
        <span className="text-2xl font-black uppercase tracking-tighter">Waamikan</span>
        <div className="flex items-center gap-1">
          <span className={`h-1 flex-grow ${dark ? 'bg-blue-400' : 'bg-[#EAB308]'} rounded-full`} />
          <span className={`text-[7px] font-black uppercase tracking-[0.25em] ${dark ? 'text-blue-200' : 'text-[#1F7A8C]'}`}>
            Supply & Imaging
          </span>
        </div>
      </div>
    )}
  </div>
);

export default Logo;
