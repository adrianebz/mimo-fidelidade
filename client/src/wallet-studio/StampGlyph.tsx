import React from 'react';
import type { StampIconKey } from './types.js';

interface StampGlyphProps {
  icon: StampIconKey;
  color: string;
  size?: number;
  className?: string;
}

/**
 * Ícones do selo desenhados em SVG (viewBox 0 0 24 24, centrados).
 *
 * Espelham os vetores de functions/wallet-icons.js, que é quem desenha a
 * imagem real do passe na Google Wallet. Foram feitos como vetor — e não com
 * emoji — porque o ambiente das Cloud Functions não tem fonte de emoji colorida
 * instalada: emoji renderizaria como caixa vazia no cartão real, e a prévia
 * mentiria para o lojista.
 */
export const StampGlyph: React.FC<StampGlyphProps> = ({ icon, color, size = 24, className = '' }) => {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    xmlns: 'http://www.w3.org/2000/svg',
    className,
  };

  switch (icon) {
    case 'coffee':
      return (
        <svg {...common}>
          <path d="M4 9h12v6.5a3.5 3.5 0 0 1-3.5 3.5h-5A3.5 3.5 0 0 1 4 15.5V9Z" fill={color} />
          <path d="M16 10.5h1.5a2.5 2.5 0 0 1 0 5H16" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
          <path d="M7.5 6.5c-.8-.9-.8-1.8 0-2.7M11 6.5c-.8-.9-.8-1.8 0-2.7" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );

    case 'star':
      return (
        <svg {...common}>
          <path d="M12 3.2l2.6 5.6 6.1.8-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.6l6.1-.8L12 3.2Z" fill={color} />
        </svg>
      );

    case 'heart':
      return (
        <svg {...common}>
          <path
            d="M12 20.5S3.5 15.2 3.5 9.4A4.9 4.9 0 0 1 12 6.2a4.9 4.9 0 0 1 8.5 3.2c0 5.8-8.5 11.1-8.5 11.1Z"
            fill={color}
          />
        </svg>
      );

    case 'sparkle':
      return (
        <svg {...common}>
          <path d="M12 2.5l2 7.5 7.5 2-7.5 2-2 7.5-2-7.5-7.5-2 7.5-2 2-7.5Z" fill={color} />
        </svg>
      );

    case 'fire':
      return (
        <svg {...common}>
          <path
            d="M13 2.5c.6 3-1.2 4.4-2.6 5.8C8.7 9.9 7 11.6 7 14.4a5.6 5.6 0 0 0 11.2 0c0-2.4-1.2-4-2.4-5.4.2 1.3-.4 2.3-1.3 2.6.5-2.7-.4-6.6-1.5-9.1Z"
            fill={color}
          />
        </svg>
      );

    case 'coin':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.2" stroke={color} strokeWidth="1.8" />
          <circle cx="12" cy="12" r="4.6" stroke={color} strokeWidth="1.4" />
          <path d="M12 6.2v1.6M12 16.2v1.6M17.8 12h-1.6M7.8 12H6.2" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );

    case 'gift':
      return (
        <svg {...common}>
          <path d="M4 11h16v8.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V11Z" fill={color} />
          <path d="M3 7.6h18V11H3V7.6Z" fill={color} />
          <path d="M10.6 7.6V20.5M13.4 7.6V20.5" stroke="rgba(0,0,0,0.35)" strokeWidth="1.6" />
          <path
            d="M12 7.4c-1.6 0-3.6-.6-3.6-2.2 0-1 .8-1.7 1.7-1.7 1.4 0 1.9 2 1.9 3.9Zm0 0c1.6 0 3.6-.6 3.6-2.2 0-1-.8-1.7-1.7-1.7-1.4 0-1.9 2-1.9 3.9Z"
            fill={color}
          />
        </svg>
      );

    case 'cookie':
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.4" fill={color} />
          <circle cx="9" cy="9.4" r="1.15" fill="rgba(0,0,0,0.38)" />
          <circle cx="14.6" cy="10.2" r="1.05" fill="rgba(0,0,0,0.38)" />
          <circle cx="11.4" cy="13.4" r="1.1" fill="rgba(0,0,0,0.38)" />
          <circle cx="15.2" cy="14.8" r="0.95" fill="rgba(0,0,0,0.38)" />
          <circle cx="8.4" cy="14.4" r="0.9" fill="rgba(0,0,0,0.38)" />
        </svg>
      );
  }
};

export default StampGlyph;
