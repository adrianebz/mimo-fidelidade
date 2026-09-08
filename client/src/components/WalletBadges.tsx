import React from 'react';

interface WalletBadgesProps {
  cardSerial?: string;
  applePassUrl?: string;
  googleSaveUrl?: string;
  onAppleClick?: () => void;
  onGoogleClick?: () => void;
  className?: string;
}

export const WalletBadges: React.FC<WalletBadgesProps> = ({
  cardSerial,
  applePassUrl,
  googleSaveUrl,
  onAppleClick,
  onGoogleClick,
  className = ''
}) => {
  const handleAppleClick = () => {
    if (onAppleClick) {
      onAppleClick();
      return;
    }
    if (applePassUrl) {
      window.open(applePassUrl, '_blank');
    } else if (cardSerial) {
      window.open(`/api/passes/apple/${cardSerial}`, '_blank');
    }
  };

  const handleGoogleClick = () => {
    if (onGoogleClick) {
      onGoogleClick();
      return;
    }
    if (googleSaveUrl) {
      window.open(googleSaveUrl, '_blank');
    } else if (cardSerial) {
      window.open(`/api/passes/google/${cardSerial}/save`, '_blank');
    }
  };

  return (
    <div className={`flex flex-col sm:flex-row items-center justify-center gap-3 ${className}`}>
      {/* Apple Wallet Badge */}
      <button
        onClick={handleAppleClick}
        type="button"
        className="group relative flex items-center gap-3 bg-black hover:bg-[#1a1a1f] border border-white/20 hover:border-white/40 text-white rounded-xl px-5 py-3 transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg w-full sm:w-auto justify-center"
        aria-label="Adicione à Apple Wallet"
      >
        {/* Apple Logo */}
        <svg className="w-7 h-7 fill-current text-white" viewBox="0 0 170 170">
          <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.7-3.04-7.7-7.85-12-14.44-6.2-9.46-11.1-20.2-14.7-32.22-3.6-12.02-5.4-23.47-5.4-34.36 0-14.57 3.65-26.68 10.95-36.33 7.3-9.65 16.5-14.6 27.6-14.85 4.9.11 10.37 1.45 16.42 4.02 6.05 2.58 10.05 3.92 12 4.04 1.63-.23 5.75-1.63 12.37-4.22 6.62-2.59 12.33-3.75 17.13-3.48 13.06.87 23.47 5.67 31.23 14.4-11.32 6.86-16.86 16.32-16.63 28.37.22 9.57 3.86 17.63 10.93 24.19 7.07 6.56 15.66 10.33 25.77 11.31-2.5 7.62-5.65 15.66-9.45 24.13zM119.22 33.15c0-7.18 2.6-13.91 7.8-20.2 5.2-6.28 11.64-10.45 19.33-12.51.98 7.62-1.32 14.74-6.9 21.36-5.58 6.63-12.32 10.41-20.23 11.35z"/>
        </svg>
        <div className="text-left flex flex-col justify-center">
          <span className="text-[10px] uppercase tracking-wider text-white/70 font-medium leading-tight">Adicione à</span>
          <span className="text-sm font-bold text-white tracking-tight leading-tight">Apple Wallet</span>
        </div>
      </button>

      {/* Google Wallet Badge */}
      <button
        onClick={handleGoogleClick}
        type="button"
        className="group relative flex items-center gap-3 bg-black hover:bg-[#1a1a1f] border border-white/20 hover:border-white/40 text-white rounded-xl px-5 py-3 transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg w-full sm:w-auto justify-center"
        aria-label="Adicione à Google Wallet"
      >
        {/* Google Wallet Icon */}
        <div className="w-7 h-7 flex items-center justify-center">
          <svg className="w-6 h-6" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M21 7.5H3a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2z"/>
            <path fill="#34A853" d="M19 12.5H5a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4a1 1 0 0 0-1-1z"/>
            <path fill="#FBBC05" d="M18 4.5H6a2 2 0 0 0-2 2v1h16v-1a2 2 0 0 0-2-2z"/>
            <circle cx="16.5" cy="15" r="1.5" fill="#EA4335"/>
          </svg>
        </div>
        <div className="text-left flex flex-col justify-center">
          <span className="text-[10px] uppercase tracking-wider text-white/70 font-medium leading-tight">Adicione à</span>
          <span className="text-sm font-bold text-white tracking-tight leading-tight">Google Wallet</span>
        </div>
      </button>
    </div>
  );
};
