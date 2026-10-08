import React from 'react';
import infinito from '../assets/boomii-infinito.png';

interface BoomiiLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'hero';
  showSubtitle?: boolean;
  className?: string;
}

const AMARELO = '#FFC82C';

/** Proporção do arquivo oficial do símbolo (394 x 202). */
const PROPORCAO_INFINITO = 394 / 202;

export const BoomiiLogo: React.FC<BoomiiLogoProps> = ({
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
  const fonte = h * 0.95;
  const alturaInfinito = fonte * 0.6;

  return (
    <div className={`inline-flex flex-col items-start select-none ${className}`}>
      {/* Wordmark BOOMII — o par de "O" é o símbolo oficial da marca */}
      <div
        className="flex items-center font-black tracking-tight text-white"
        style={{ fontSize: fonte, lineHeight: 1 }}
        role="img"
        aria-label="BOOMII"
      >
        <span>B</span>
        <img
          src={infinito}
          alt=""
          aria-hidden="true"
          style={{
            height: alturaInfinito,
            width: alturaInfinito * PROPORCAO_INFINITO,
            marginInline: fonte * 0.04,
            display: 'block'
          }}
        />
        <span>MII</span>
      </div>

      {showSubtitle && (
        <span
          className="font-bold uppercase mt-1"
          style={{
            fontSize: Math.max(8, h * 0.2),
            letterSpacing: '0.34em',
            color: AMARELO
          }}
        >
          Loyalty Club
        </span>
      )}
    </div>
  );
};
