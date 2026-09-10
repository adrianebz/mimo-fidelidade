/**
 * Biblioteca de ícones vetoriais para os selos do cartão MIMO renderizados no
 * banner real da Google Wallet (Cloud Function `generateBanner`, motor PureImage).
 *
 * PureImage roda em ambiente headless (Cloud Functions) sem fonte de emoji colorida
 * disponível, então os ícones abaixo são desenhados com primitivas de canvas
 * (arc/bezier/linhas) em vez de caracteres de emoji — funcionam sempre, em qualquer
 * cor de destaque escolhida pelo lojista.
 */

const STAMP_ICON_KEYS = ['cookie', 'coffee', 'star', 'heart', 'sparkle', 'fire', 'coin'];

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function hexToRgb(hex) {
  const clean = String(hex || '#FFC82C').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean.padEnd(6, '0');
  const r = parseInt(full.substring(0, 2), 16) || 0;
  const g = parseInt(full.substring(2, 4), 16) || 0;
  const b = parseInt(full.substring(4, 6), 16) || 0;
  return { r, g, b };
}

function rgbToHex(r, g, b) {
  const toHex = (n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Escurece uma cor hex por um fator 0..1 (0 = preto, 1 = cor original) */
function darken(hex, factor) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(r * factor, g * factor, b * factor);
}

/** Relative luminance simplificada (suficiente para decidir contraste do ícone) */
function luminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** Retorna preto ou branco translúcido, o que tiver melhor contraste sobre a cor de fundo */
function contrastIconColor(bgHex) {
  return luminance(bgHex) > 0.6 ? 'rgba(10,10,12,0.62)' : 'rgba(255,255,255,0.92)';
}

function circlePath(ctx, cx, cy, r) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
}

/** Caminho de estrela genérico (usado para 'star', 'sparkle' e o badge do prêmio) */
function starPath(ctx, cx, cy, outerR, innerR, points) {
  ctx.beginPath();
  const step = Math.PI / points;
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = step * i - Math.PI / 2;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/**
 * Desenha a base "medalha" (moeda dourada) atrás de um selo preenchido.
 * Usada tanto para os ícones vetoriais quanto para imagens customizadas (como fundo).
 */
function drawMedallionBase(ctx, cx, cy, r, accentHex, dim) {
  // NOTA: pureimage's ctx.restore() só restaura _clip e _transform — NÃO restaura
  // globalAlpha/fillStyle/strokeStyle. Por isso o alpha é sempre salvo/restaurado
  // manualmente aqui (e em todas as funções abaixo), senão "vaza" para os próximos
  // desenhos no mesmo canvas.
  const prevAlpha = ctx.globalAlpha;
  if (dim) ctx.globalAlpha = 0.35;

  ctx.fillStyle = darken(accentHex, 0.55);
  circlePath(ctx, cx, cy, r);
  ctx.fill();

  ctx.fillStyle = accentHex;
  circlePath(ctx, cx, cy, r * 0.86);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = Math.max(1, r * 0.05);
  circlePath(ctx, cx, cy, r * 0.7);
  ctx.stroke();

  ctx.globalAlpha = prevAlpha;
}

/** Anel vazio (selo ainda não conquistado) */
function drawEmptySlot(ctx, cx, cy, r) {
  ctx.save();
  circlePath(ctx, cx, cy, r);
  ctx.fillStyle = 'rgba(255,255,255,0.045)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = Math.max(1.5, r * 0.06);
  circlePath(ctx, cx, cy, r);
  ctx.stroke();
  ctx.restore();
}

function drawCookie(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  circlePath(ctx, cx, cy, r * 0.82);
  ctx.fill();
  const prevAlpha = ctx.globalAlpha;
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  const chips = [[-0.32, -0.28], [0.28, -0.22], [-0.05, 0.05], [0.34, 0.22], [-0.36, 0.3], [0.02, -0.4]];
  chips.forEach(([dx, dy]) => {
    circlePath(ctx, cx + dx * r, cy + dy * r, r * 0.1);
    ctx.fill();
  });
  ctx.globalAlpha = prevAlpha;
}

function drawCoffee(ctx, cx, cy, r, color) {
  const bodyW = r * 1.05;
  const bodyH = r * 0.85;
  const bx = cx - bodyW / 2;
  const by = cy - bodyH / 2 + r * 0.18;

  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(bx, by, bodyW, bodyH, r * 0.14);
    ctx.fill();
  } else {
    ctx.fillRect(bx, by, bodyW, bodyH);
  }

  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(3, r * 0.2);
  ctx.beginPath();
  ctx.arc(bx + bodyW + r * 0.16, by + bodyH * 0.5, r * 0.3, -Math.PI * 0.55, Math.PI * 0.55);
  ctx.stroke();

  ctx.lineWidth = Math.max(2.5, r * 0.13);
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.2, by - r * 0.1);
  ctx.quadraticCurveTo(cx - r * 0.38, by - r * 0.32, cx - r * 0.14, by - r * 0.54);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + r * 0.12, by - r * 0.1);
  ctx.quadraticCurveTo(cx - r * 0.06, by - r * 0.32, cx + r * 0.18, by - r * 0.54);
  ctx.stroke();
}

function drawHeart(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy + r * 0.58);
  ctx.bezierCurveTo(cx - r * 1.05, cy - r * 0.12, cx - r * 0.48, cy - r * 1.0, cx, cy - r * 0.32);
  ctx.bezierCurveTo(cx + r * 0.48, cy - r * 1.0, cx + r * 1.05, cy - r * 0.12, cx, cy + r * 0.58);
  ctx.closePath();
  ctx.fill();
}

function drawFire(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy + r * 0.82);
  ctx.bezierCurveTo(cx - r * 0.72, cy + r * 0.5, cx - r * 0.6, cy - r * 0.05, cx - r * 0.14, cy - r * 0.82);
  ctx.bezierCurveTo(cx - r * 0.04, cy - r * 0.42, cx + r * 0.26, cy - r * 0.42, cx + r * 0.14, cy - r * 0.04);
  ctx.bezierCurveTo(cx + r * 0.48, cy - r * 0.18, cx + r * 0.62, cy + r * 0.2, cx + r * 0.32, cy + r * 0.48);
  ctx.bezierCurveTo(cx + r * 0.42, cy + r * 0.24, cx + r * 0.14, cy + r * 0.14, cx + r * 0.1, cy + r * 0.34, );
  ctx.bezierCurveTo(cx + r * 0.06, cy + r * 0.54, cx - r * 0.14, cy + r * 0.62, cx, cy + r * 0.82);
  ctx.closePath();
  ctx.fill();
}

function drawCoin(ctx, cx, cy, r, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, r * 0.1);
  circlePath(ctx, cx, cy, r * 0.72);
  ctx.stroke();
  circlePath(ctx, cx, cy, r * 0.46);
  ctx.stroke();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r * 0.78, cy + Math.sin(a) * r * 0.78);
    ctx.lineTo(cx + Math.cos(a) * r * 0.94, cy + Math.sin(a) * r * 0.94);
    ctx.lineWidth = Math.max(1.5, r * 0.055);
    ctx.stroke();
  }
}

/** Desenha o glifo do selo escolhido pelo lojista (fallback quando não há imagem customizada) */
function drawStampGlyph(ctx, key, cx, cy, r, color) {
  switch (key) {
    case 'coffee':
      return drawCoffee(ctx, cx, cy, r, color);
    case 'star':
      starPath(ctx, cx, cy, r * 0.92, r * 0.4, 5);
      ctx.fillStyle = color;
      return ctx.fill();
    case 'heart':
      return drawHeart(ctx, cx, cy, r, color);
    case 'sparkle':
      starPath(ctx, cx, cy, r * 0.92, r * 0.16, 4);
      ctx.fillStyle = color;
      return ctx.fill();
    case 'fire':
      return drawFire(ctx, cx, cy, r, color);
    case 'coin':
      return drawCoin(ctx, cx, cy, r, color);
    case 'cookie':
    default:
      return drawCookie(ctx, cx, cy, r, color);
  }
}

/** Ícone de presente/caixa para o selo especial do 10º (fallback sem imagem customizada) */
function drawGiftIcon(ctx, cx, cy, r, color) {
  const w = r * 1.15;
  const h = r * 0.85;
  const x = cx - w / 2;
  const y = cy - h / 2 + r * 0.12;
  const lidH = h * 0.26;

  ctx.fillStyle = color;
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r * 0.08);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(x - r * 0.05, y - lidH, w + r * 0.1, lidH, r * 0.06);
    ctx.fill();
  } else {
    ctx.fillRect(x, y, w, h);
    ctx.fillRect(x - r * 0.05, y - lidH, w + r * 0.1, lidH);
  }

  const prevAlpha = ctx.globalAlpha;
  ctx.globalAlpha = 0.32;
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.fillRect(cx - w * 0.08, y - lidH, w * 0.16, h + lidH);
  ctx.globalAlpha = prevAlpha;

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, y - lidH - r * 0.02);
  ctx.lineTo(cx - r * 0.24, y - lidH - r * 0.26);
  ctx.lineTo(cx - r * 0.02, y - lidH - r * 0.04);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx, y - lidH - r * 0.02);
  ctx.lineTo(cx + r * 0.24, y - lidH - r * 0.26);
  ctx.lineTo(cx + r * 0.02, y - lidH - r * 0.04);
  ctx.closePath();
  ctx.fill();
}

/** Badge circular com estrela no canto do selo do prêmio (substitui o antigo caractere emoji) */
function drawStarBadge(ctx, cx, cy, r, accentHex, dim) {
  const prevAlpha = ctx.globalAlpha;
  if (dim) ctx.globalAlpha = 0.45;

  circlePath(ctx, cx, cy, r);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.strokeStyle = darken(accentHex, 0.7);
  ctx.lineWidth = Math.max(1.5, r * 0.14);
  circlePath(ctx, cx, cy, r);
  ctx.stroke();

  starPath(ctx, cx, cy, r * 0.62, r * 0.26, 5);
  ctx.fillStyle = accentHex;
  ctx.fill();

  ctx.globalAlpha = prevAlpha;
}

module.exports = {
  STAMP_ICON_KEYS,
  darken,
  contrastIconColor,
  drawMedallionBase,
  drawEmptySlot,
  drawStampGlyph,
  drawGiftIcon,
  drawStarBadge,
  starPath,
};
