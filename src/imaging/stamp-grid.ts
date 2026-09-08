/**
 * Dynamic SVG Generator for Wallet Pass Stamp Grids (Apple Wallet strip.png / Google Wallet heroImage)
 * Dimensions: 1125 x 432 px
 */
export function generateStampGridSvg(
  stampsCount: number,
  rewardLabel: string = 'Cookie Grátis',
  options: {
    backgroundColor?: string;
    accentColor?: string;
    emptyColor?: string;
    textColor?: string;
    storeName?: string;
  } = {}
): string {
  const bg = options.backgroundColor || '#0F0F10';
  const accent = options.accentColor || '#FFC82C';
  const empty = options.emptyColor || '#8ABABF';
  const text = options.textColor || '#FFFFFF';
  const count = Math.max(0, Math.min(10, stampsCount));

  // 10 stamps in 2 rows of 5
  // Width 1125, Height 432
  const colSpacing = 190;
  const startX = 180;
  const row1Y = 160;
  const row2Y = 310;
  const radius = 52;

  const circles: string[] = [];

  for (let i = 1; i <= 10; i++) {
    const isRow1 = i <= 5;
    const colIndex = isRow1 ? i - 1 : i - 6;
    const cx = startX + colIndex * colSpacing;
    const cy = isRow1 ? row1Y : row2Y;
    const isFilled = i <= count;
    const is10th = i === 10;

    if (isFilled) {
      // Golden / Mimo Yellow coin with gradient and smile
      circles.push(`
        <g filter="url(#goldGlow)">
          <circle cx="${cx}" cy="${cy}" r="${radius}" fill="url(#goldGradient)" stroke="#FFE885" stroke-width="3"/>
          <circle cx="${cx}" cy="${cy}" r="${radius - 6}" fill="none" stroke="#B8860B" stroke-width="1.5" stroke-dasharray="4,3"/>
          <!-- Mascot / Smile Icon inside coin -->
          <path d="M ${cx - 18} ${cy + 6} Q ${cx} ${cy + 22} ${cx + 18} ${cy + 6}" fill="none" stroke="#2D1F00" stroke-width="5" stroke-linecap="round"/>
          <circle cx="${cx - 12}" cy="${cy - 8}" r="3.5" fill="#2D1F00"/>
          <circle cx="${cx + 12}" cy="${cy - 8}" r="3.5" fill="#2D1F00"/>
          <!-- Shine highlight -->
          <ellipse cx="${cx - 16}" cy="${cy - 18}" rx="14" ry="6" fill="#FFFFFF" opacity="0.35" transform="rotate(-25 ${cx - 16} ${cy - 18})"/>
        </g>
      `);
    } else if (is10th) {
      // 10th spot: Special Reward Target
      circles.push(`
        <g>
          <circle cx="${cx}" cy="${cy}" r="${radius}" fill="#1F1F24" stroke="${accent}" stroke-width="2.5" stroke-dasharray="6,4"/>
          <!-- Gift / Star outline -->
          <path d="M ${cx} ${cy - 20} L ${cx + 7} ${cy - 5} L ${cx + 22} ${cy - 3} L ${cx + 11} ${cy + 9} L ${cx + 14} ${cy + 24} L ${cx} ${cy + 16} L ${cx - 14} ${cy + 24} L ${cx - 11} ${cy + 9} L ${cx - 22} ${cy - 3} L ${cx - 7} ${cy - 5} Z" fill="none" stroke="${accent}" stroke-width="2"/>
          <text x="${cx}" y="${cy + 34}" font-family="Montserrat, -apple-system, sans-serif" font-size="12" font-weight="700" fill="${accent}" text-anchor="middle" letter-spacing="1">10</text>
        </g>
      `);
    } else {
      // Empty stamp placeholder
      circles.push(`
        <g>
          <circle cx="${cx}" cy="${cy}" r="${radius}" fill="#16161A" stroke="${empty}" stroke-opacity="0.3" stroke-width="2"/>
          <text x="${cx}" y="${cy + 6}" font-family="Montserrat, -apple-system, sans-serif" font-size="22" font-weight="600" fill="${empty}" fill-opacity="0.45" text-anchor="middle">${i}</text>
        </g>
      `);
    }
  }

  const isRewardReady = count >= 10;
  const statusBadge = isRewardReady
    ? `<rect x="360" y="372" width="405" height="42" rx="21" fill="#16A34A" filter="url(#goldGlow)"/>
       <text x="562" y="399" font-family="Montserrat, -apple-system, sans-serif" font-size="16" font-weight="700" fill="#FFFFFF" text-anchor="middle" letter-spacing="1.5">RECOMPENSA DISPONÍVEL: ${rewardLabel.toUpperCase()}</text>`
    : `<text x="562" y="398" font-family="Montserrat, -apple-system, sans-serif" font-size="15" font-weight="500" fill="${empty}" fill-opacity="0.85" text-anchor="middle" letter-spacing="1">${10 - count} ${10 - count === 1 ? 'selo restante' : 'selos restantes'} para ${rewardLabel}</text>`;

  return `<svg width="1125" height="432" viewBox="0 0 1125 432" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFE57F"/>
      <stop offset="35%" stop-color="${accent}"/>
      <stop offset="70%" stop-color="#E5A812"/>
      <stop offset="100%" stop-color="#B8860B"/>
    </linearGradient>
    <filter id="goldGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000000" flood-opacity="0.6"/>
    </filter>
  </defs>

  <!-- Card Canvas Background -->
  <rect width="1125" height="432" fill="${bg}"/>

  <!-- Subtle Header info -->
  <text x="60" y="58" font-family="Montserrat, -apple-system, sans-serif" font-size="16" font-weight="700" fill="${empty}" fill-opacity="0.7" letter-spacing="2.5">CARTÃO DE FIDELIDADE</text>
  <text x="1065" y="58" font-family="Montserrat, -apple-system, sans-serif" font-size="28" font-weight="800" fill="${accent}" text-anchor="end">${count} / 10</text>

  <!-- 10 Stamps Grid -->
  ${circles.join('\n')}

  <!-- Status / Reward footer -->
  ${statusBadge}
</svg>`;
}
