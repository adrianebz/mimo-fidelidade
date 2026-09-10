import React from 'react';
import type { CardDesign } from './types.js';
import { StampGlyph } from './StampGlyph.js';

interface StampGridProps {
  design: CardDesign;
  earned: number;
  /** Tamanho do selo em px. */
  cell?: number;
  compact?: boolean;
}

function shapeRadius(shape: CardDesign['stamps']['shape'], cell: number): string {
  if (shape === 'circle') return '9999px';
  if (shape === 'rounded') return `${Math.round(cell * 0.28)}px`;
  return '2px';
}

/**
 * Cartela de selos. O último slot é sempre o selo do prêmio (visualmente
 * distinto), como no cartão de referência: conquistados em cor sólida,
 * pendentes translúcidos e o prêmio com borda tracejada.
 */
export const StampGrid: React.FC<StampGridProps> = ({ design, earned, cell = 40, compact = false }) => {
  const { stamps, colors, reward } = design;
  const total = Math.max(1, stamps.total);
  const radius = shapeRadius(stamps.shape, cell);
  const gap = compact ? Math.round(cell * 0.18) : Math.round(cell * 0.24);

  return (
    <div
      className="grid"
      style={{
        gridTemplateColumns: `repeat(${Math.min(stamps.columns, total)}, minmax(0, 1fr))`,
        gap,
        justifyItems: 'center',
      }}
    >
      {Array.from({ length: total }).map((_, index) => {
        const position = index + 1;
        const isEarned = position <= earned;
        const isReward = position === total;

        // ── Selo do prêmio (último da cartela) ─────────────────────────────
        if (isReward) {
          return (
            <div
              key={position}
              style={{
                width: cell,
                height: cell,
                borderRadius: radius,
                backgroundColor: isEarned ? reward.color : 'transparent',
                border: isEarned ? 'none' : `2px dashed ${colors.stampInk}66`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                boxShadow: isEarned ? `0 0 0 2px ${colors.text}55` : 'none',
              }}
              title={reward.label}
            >
              {reward.imageDataUrl ? (
                <img
                  src={reward.imageDataUrl}
                  alt={reward.label}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <StampGlyph
                  icon={reward.iconKey}
                  color={isEarned ? colors.stampInk : `${colors.stampInk}99`}
                  size={Math.round(cell * 0.5)}
                />
              )}
            </div>
          );
        }

        // ── Selo conquistado ───────────────────────────────────────────────
        if (isEarned) {
          return (
            <div
              key={position}
              style={{
                width: cell,
                height: cell,
                borderRadius: radius,
                backgroundColor: colors.background,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                color: colors.text,
                fontWeight: 800,
                fontSize: Math.round(cell * 0.38),
                lineHeight: 1,
              }}
            >
              {stamps.fill === 'image' && stamps.imageDataUrl ? (
                <img
                  src={stamps.imageDataUrl}
                  alt={`Selo ${position}`}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : stamps.fill === 'icon' ? (
                <StampGlyph icon={stamps.iconKey} color={colors.text} size={Math.round(cell * 0.52)} />
              ) : (
                <span>{position}</span>
              )}
            </div>
          );
        }

        // ── Selo pendente ──────────────────────────────────────────────────
        return (
          <div
            key={position}
            style={{
              width: cell,
              height: cell,
              borderRadius: radius,
              backgroundColor: `${colors.stampInk}22`,
              border: `1px solid ${colors.stampInk}33`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: `${colors.stampInk}88`,
              fontWeight: 700,
              fontSize: Math.round(cell * 0.34),
              lineHeight: 1,
            }}
          >
            {stamps.showNumbersOnEmpty ? position : ''}
          </div>
        );
      })}
    </div>
  );
};

export default StampGrid;
