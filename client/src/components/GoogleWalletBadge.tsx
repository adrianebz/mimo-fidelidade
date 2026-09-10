import React from 'react';

interface GoogleWalletBadgeProps {
  href: string;
  onClick?: () => void;
  className?: string;
}

/**
 * Componente oficial do botão "Adicionar à Carteira do Google"
 * Renderizado em SVG vetorial de alta definição para evitar dependências de URLs externas e erros 404.
 */
export const GoogleWalletBadge: React.FC<GoogleWalletBadgeProps> = ({ href, onClick, className = '' }) => {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      onClick={onClick}
      id="btn-add-google-wallet"
      className={`group inline-flex items-center gap-3 px-6 py-3 rounded-full bg-black border border-white/20 hover:border-white/50 hover:bg-zinc-900 active:scale-95 transition-all duration-200 shadow-xl cursor-pointer select-none ${className}`}
      style={{
        boxShadow: '0 4px 14px 0 rgba(0, 0, 0, 0.45)',
      }}
      title="Adicionar cartão à Google Carteira"
    >
      {/* Ícone Oficial Google Wallet (4 Cores Google) */}
      <svg
        width="26"
        height="26"
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 transition-transform group-hover:scale-105"
      >
        <rect width="40" height="40" rx="10" fill="#1F1F1F" />
        {/* Dobra Superior Azul */}
        <path
          d="M10 14.5C10 12.567 11.567 11 13.5 11H26.5C28.433 11 30 12.567 30 14.5V17H10V14.5Z"
          fill="#4285F4"
        />
        {/* Face Lateral Verde */}
        <path
          d="M10 17H14V27.5C14 28.3284 13.3284 29 12.5 29H11.5C10.6716 29 10 28.3284 10 27.5V17Z"
          fill="#34A853"
        />
        {/* Base Amarela */}
        <path
          d="M12.5 29H27.5C28.3284 29 29 28.3284 29 27.5V25H11V27.5C11 28.3284 11.6716 29 12.5 29Z"
          fill="#FBBC04"
        />
        {/* Face Lateral Direita Vermelha */}
        <path
          d="M26 17H30V27.5C30 28.3284 29.3284 29 28.5 29H27.5C26.6716 29 26 28.3284 26 27.5V17Z"
          fill="#EA4335"
        />
        {/* Cartão Branco Inserido */}
        <rect x="13" y="14" width="14" height="10" rx="2" fill="#FFFFFF" />
        <line x1="15" y1="17" x2="21" y2="17" stroke="#1F1F1F" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="15" y1="20" x2="19" y2="20" stroke="#757575" strokeWidth="1" strokeLinecap="round" />
      </svg>

      {/* Tipografia Oficial */}
      <div className="flex flex-col items-start text-left leading-none">
        <span className="text-[10px] uppercase font-semibold text-zinc-400 tracking-wider">
          Adicionar à
        </span>
        <span className="text-[14px] font-semibold text-white tracking-tight mt-0.5">
          Carteira do Google
        </span>
      </div>
    </a>
  );
};

export default GoogleWalletBadge;
