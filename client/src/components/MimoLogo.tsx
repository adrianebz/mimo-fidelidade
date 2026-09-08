import React from 'react';

interface MimoLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'hero';
  showSubtitle?: boolean;
  className?: string;
}

export const MimoLogo: React.FC<MimoLogoProps> = ({
  size = 'md',
  showSubtitle = true,
  className = ''
}) => {
  const heights = {
    sm: 24,
    md: 34,
    lg: 48,
    hero: 64
  };

  const h = heights[size];

  return (
    <div className={`inline-flex flex-col items-start select-none ${className}`}>
      <div className="flex items-center gap-2">
        {/* Cute Smiling Face Mascot Icon */}
        <div
          className="rounded-2xl flex items-center justify-center font-bold"
          style={{
            width: h * 1.05,
            height: h * 1.05,
            backgroundColor: '#FFC82C',
            color: '#0F0F10',
            boxShadow: '0 4px 16px rgba(255, 200, 44, 0.35)'
          }}
        >
          <svg
            width={h * 0.7}
            height={h * 0.7}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#0F0F10"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* 'm' shape eyes / eyebrows and happy smile */}
            <path d="M 6 9 Q 8 6 10 9 Q 12 6 14 9" />
            <path d="M 14 9 Q 16 6 18 9" />
            <path d="M 7 14 Q 12 19 17 14" strokeWidth="2.8" />
          </svg>
        </div>

        {/* Wordmark "mimo" */}
        <div className="flex flex-col justify-center">
          <div className="flex items-baseline font-black tracking-tight" style={{ fontSize: h * 0.88, lineHeight: 1 }}>
            <span className="text-white">mi</span>
            <span className="text-white relative">
              mo
              {/* Golden smile curve under 'o' */}
              <svg
                className="absolute -bottom-1 right-0 w-full"
                height="6"
                viewBox="0 0 30 6"
                fill="none"
              >
                <path d="M 2 2 Q 15 7 28 2" stroke="#FFC82C" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </span>
          </div>
        </div>
      </div>

      {showSubtitle && (
        <span
          className="text-white/60 font-bold tracking-widest uppercase mt-1 pl-1"
          style={{ fontSize: Math.max(9, h * 0.22), letterSpacing: '0.22em' }}
        >
          Fidelidade Digital
        </span>
      )}
    </div>
  );
};
