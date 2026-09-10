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

/**
 * Caminho do selo conforme o formato escolhido pelo lojista.
 * 'circle' | 'rounded' | 'square' — precisa casar com StampShape no cliente.
 */
function shapePath(ctx, shape, cx, cy, r) {
  if (shape === 'square' || shape === 'rounded') {
    const size = r * 1.82;
    const x = cx - size / 2;
    const y = cy - size / 2;
    const radius = shape === 'rounded' ? r * 0.5 : 0;
    ctx.beginPath();
    if (radius > 0 && typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, y, size, size, radius);
    } else {
      ctx.rect(x, y, size, size);
    }
    return;
  }
  circlePath(ctx, cx, cy, r);
}

/** Elipse via transformação (pureimage não tem ellipse() confiável). */
function ellipsePath(ctx, cx, cy, rx, ry) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(rx, ry);
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.restore();
}

/**
 * Desenha um dígito (0-9) como vetor.
 *
 * O ambiente das Cloud Functions não tem fonte instalada e o pureimage exige
 * registrar um TTF para usar fillText — desenhar os dígitos à mão evita essa
 * dependência e garante que o número do selo apareça no cartão real.
 */
function drawDigit(ctx, digit, cx, cy, size, color) {
  const h = size;
  const w = size * 0.62;
  const X = (n) => cx + n * w;
  const Y = (n) => cy + n * h;

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1.5, size * 0.17);

  const strokeEllipse = (ecx, ecy, erx, ery) => {
    ellipsePath(ctx, ecx, ecy, erx, ery);
    ctx.stroke();
  };

  switch (String(digit)) {
    case '0':
      strokeEllipse(cx, cy, w * 0.42, h * 0.48);
      break;
    case '1':
      ctx.beginPath();
      ctx.moveTo(X(-0.22), Y(-0.28));
      ctx.lineTo(X(0.02), Y(-0.48));
      ctx.lineTo(X(0.02), Y(0.48));
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(X(-0.24), Y(0.48));
      ctx.lineTo(X(0.28), Y(0.48));
      ctx.stroke();
      break;
    case '2':
      ctx.beginPath();
      ctx.arc(cx, Y(-0.22), w * 0.4, Math.PI * 0.95, Math.PI * 2.1);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(X(0.4), Y(-0.12));
      ctx.lineTo(X(-0.36), Y(0.48));
      ctx.lineTo(X(0.4), Y(0.48));
      ctx.stroke();
      break;
    case '3':
      ctx.beginPath();
      ctx.arc(cx, Y(-0.24), w * 0.38, Math.PI * 1.1, Math.PI * 0.6);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, Y(0.22), w * 0.42, Math.PI * 1.5, Math.PI * 0.9);
      ctx.stroke();
      break;
    case '4':
      ctx.beginPath();
      ctx.moveTo(X(0.16), Y(0.48));
      ctx.lineTo(X(0.16), Y(-0.48));
      ctx.lineTo(X(-0.38), Y(0.16));
      ctx.lineTo(X(0.42), Y(0.16));
      ctx.stroke();
      break;
    case '5':
      ctx.beginPath();
      ctx.moveTo(X(0.34), Y(-0.46));
      ctx.lineTo(X(-0.26), Y(-0.46));
      ctx.lineTo(X(-0.3), Y(-0.02));
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, Y(0.16), w * 0.42, Math.PI * 1.42, Math.PI * 0.82);
      ctx.stroke();
      break;
    case '6':
      ctx.beginPath();
      ctx.arc(cx, Y(0.16), w * 0.4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(X(0.3), Y(-0.46));
      ctx.lineTo(X(-0.28), Y(0.02));
      ctx.stroke();
      break;
    case '7':
      ctx.beginPath();
      ctx.moveTo(X(-0.36), Y(-0.46));
      ctx.lineTo(X(0.38), Y(-0.46));
      ctx.lineTo(X(-0.08), Y(0.48));
      ctx.stroke();
      break;
    case '8':
      strokeEllipse(cx, Y(-0.24), w * 0.34, h * 0.24);
      strokeEllipse(cx, Y(0.22), w * 0.42, h * 0.26);
      break;
    case '9':
      ctx.beginPath();
      ctx.arc(cx, Y(-0.18), w * 0.4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(X(0.32), Y(-0.02));
      ctx.lineTo(X(-0.16), Y(0.48));
      ctx.stroke();
      break;
    default:
      break;
  }
}

/** Escreve um número inteiro (1, 2, … 12) centrado em (cx, cy). */
function drawNumber(ctx, value, cx, cy, size, color) {
  const digits = String(Math.max(0, Math.floor(value)));
  const digitW = size * 0.62;
  const spacing = digitW * 1.12;
  const startX = cx - ((digits.length - 1) * spacing) / 2;
  for (let i = 0; i < digits.length; i++) {
    drawDigit(ctx, digits[i], startX + i * spacing, cy, size, color);
  }
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
function drawMedallionBase(ctx, cx, cy, r, accentHex, dim, shape = 'circle') {
  // NOTA: pureimage's ctx.restore() só restaura _clip e _transform — NÃO restaura
  // globalAlpha/fillStyle/strokeStyle. Por isso o alpha é sempre salvo/restaurado
  // manualmente aqui (e em todas as funções abaixo), senão "vaza" para os próximos
  // desenhos no mesmo canvas.
  const prevAlpha = ctx.globalAlpha;
  if (dim) ctx.globalAlpha = 0.35;

  ctx.fillStyle = darken(accentHex, 0.55);
  shapePath(ctx, shape, cx, cy, r);
  ctx.fill();

  ctx.fillStyle = accentHex;
  shapePath(ctx, shape, cx, cy, r * 0.86);
  ctx.fill();

  ctx.globalAlpha = prevAlpha;
}

/** Anel vazio (selo ainda não conquistado) */
function drawEmptySlot(ctx, cx, cy, r, inkHex = '#000000', shape = 'circle', panelHex = null) {
  // A borda é feita com dois preenchimentos concêntricos em vez de stroke:
  // roundRect + stroke no pureimage fecha o contorno errado e deforma o selo.
  shapePath(ctx, shape, cx, cy, r);
  ctx.fillStyle = withAlpha(inkHex, 0.26);
  ctx.fill();

  shapePath(ctx, shape, cx, cy, r * 0.9);
  ctx.fillStyle = panelHex ? panelHex : withAlpha(inkHex, 0.1);
  ctx.fill();

  if (panelHex) {
    // Leve escurecimento interno para o slot não sumir dentro do painel
    shapePath(ctx, shape, cx, cy, r * 0.9);
    ctx.fillStyle = withAlpha(inkHex, 0.12);
    ctx.fill();
  }
}

/** Converte hex + alpha em rgba() (pureimage aceita string rgba no fillStyle). */
function withAlpha(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
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
  withAlpha,
  contrastIconColor,
  drawMedallionBase,
  drawEmptySlot,
  drawStampGlyph,
  drawGiftIcon,
  drawStarBadge,
  drawDigit,
  drawNumber,
  shapePath,
  starPath,
};
