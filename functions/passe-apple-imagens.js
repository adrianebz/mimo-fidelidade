/**
 * Imagens do passe Apple que nós desenhamos: a faixa (strip) com a cartela e o
 * logo do cabeçalho.
 *
 * São as únicas partes do passe sob nosso controle de pixel — campos, cabeçalho
 * e QR são desenhados pelo próprio iOS. Por isso a prévia do Estúdio pede estas
 * mesmas imagens à Cloud Function `previaPasseApple` em vez de desenhá-las no
 * navegador: assim o lojista vê exatamente os pixels que vão para o iPhone.
 *
 * Medidas em pontos (pt) da Apple; `escala` converte para px (@2x, @3x).
 */
const walletIcons = require('./wallet-icons');
const { loadBase64Image, bitmapToPngBuffer, resolverEstiloSelos, carregarImagensSelos, desenharSelo } = require('./banner');
const { desenharTexto, ajustarTexto, alturaMaiusculas } = require('./texto');

/** Geometria da faixa. Alterar aqui muda o passe real e a prévia ao mesmo tempo. */
const FAIXA = {
  largura: 375, // pt — tamanho da strip do storeCard
  altura: 144,
  margem: 8, // fundo do cartão visível em volta do painel
  raioPainel: 14,
  respiro: 9, // espaço interno do painel
  slogan: { tamanho: 8, tamanhoMin: 6, tracking: 0.16, espaco: 5 },
  ocupacaoSelo: 0.95, // fração da célula ocupada pelo selo
  folgaHorizontal: 1.08, // espaçamento horizontal máximo em relação ao vertical
};

const LOGO = { lado: 50 }; // pt — badge circular, dentro do limite de 160×50 da Apple

function resolverMeta(design, loja, meta) {
  const v = parseInt(String(meta || design?.stamps?.total || loja?.regras?.meta || 10), 10) || 10;
  return Math.max(1, Math.min(30, v));
}

/**
 * Calcula posições e tamanhos da faixa, sem desenhar.
 * Separado do desenho para poder ser conferido isoladamente.
 */
function layoutFaixa(loja, meta, escala) {
  const design = loja.design || null;
  const layout = loja.layout || {};
  const e = escala;

  const painel = {
    x: FAIXA.margem * e,
    y: FAIXA.margem * e,
    w: (FAIXA.largura - FAIXA.margem * 2) * e,
    h: (FAIXA.altura - FAIXA.margem * 2) * e,
  };
  const area = {
    x: painel.x + FAIXA.respiro * e,
    y: painel.y + FAIXA.respiro * e,
    w: painel.w - FAIXA.respiro * 2 * e,
    h: painel.h - FAIXA.respiro * 2 * e,
  };

  const colunasConfig = Number(design?.stamps?.columns || layout.stampColumns || 5);
  const colunas = Math.min(Math.max(3, colunasConfig), meta);
  const linhas = Math.ceil(meta / colunas);

  // Todo o espaço vertical da faixa é dedicado à grade de selos, centralizada no painel
  const passoY = area.h / linhas;
  const passoX = Math.min(area.w / colunas, passoY * FAIXA.folgaHorizontal);
  const raio = (Math.min(passoX, passoY) * 0.90) / 2;

  const larguraGrade = passoX * colunas;
  const alturaGrade = passoY * linhas;
  const origemX = area.x + (area.w - larguraGrade) / 2;
  const topoGrade = area.y + (area.h - alturaGrade) / 2;

  const selos = [];
  for (let i = 0; i < meta; i++) {
    selos.push({
      cx: origemX + passoX * ((i % colunas) + 0.5),
      cy: topoGrade + passoY * (Math.floor(i / colunas) + 0.5),
      posicao: i + 1,
    });
  }

  return { painel, slogan: null, selos, raio, colunas, linhas };
}

/** Faixa do passe (strip.png). */
async function renderFaixaApple(loja, selosConquistados, meta, escala) {
  const PImage = require('pureimage');
  const design = loja.design || null;
  const total = resolverMeta(design, loja, meta);
  const estilo = resolverEstiloSelos(loja);
  const W = Math.round(FAIXA.largura * escala);
  const H = Math.round(FAIXA.altura * escala);

  const img = PImage.make(W, H);
  const ctx = img.getContext('2d');
  ctx.fillStyle = estilo.bgColor;
  ctx.fillRect(0, 0, W, H);

  const g = layoutFaixa(loja, total, escala);
  ctx.fillStyle = estilo.accentColor;
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(g.painel.x, g.painel.y, g.painel.w, g.painel.h, FAIXA.raioPainel * escala);
    ctx.fill();
  } else {
    ctx.fillRect(g.painel.x, g.painel.y, g.painel.w, g.painel.h);
  }

  const imagens = await carregarImagensSelos(loja);
  for (const s of g.selos) {
    desenharSelo(ctx, {
      cx: s.cx,
      cy: s.cy,
      raio: g.raio,
      posicao: s.posicao,
      conquistado: s.posicao <= selosConquistados,
      premio: s.posicao === total,
      estilo,
      imagens,
      raioBadge: g.raio * 0.365,
      semContorno: true,
    });
  }
  return img;
}

/**
 * Logo do cabeçalho (logo.png): o logo do lojista recortado num círculo na cor
 * de destaque — o mesmo selo redondo que o Estúdio sempre mostrou.
 */
async function renderLogoApple(loja, escala, logoPadrao) {
  const PImage = require('pureimage');
  const design = loja.design || null;
  const layout = loja.layout || {};
  const estilo = resolverEstiloSelos(loja);
  const L = Math.round(LOGO.lado * escala);
  const r = L / 2;

  const img = PImage.make(L, L);
  const ctx = img.getContext('2d');
  if (typeof ctx.clearRect === 'function') ctx.clearRect(0, 0, L, L);

  ctx.fillStyle = estilo.accentColor;
  ctx.beginPath();
  ctx.arc(r, r, r, 0, Math.PI * 2);
  ctx.fill();

  const logo = await loadBase64Image(design?.brand?.logoDataUrl || layout.logoBase64);
  if (logo) {
    // Encaixa o logo proporcionalmente dentro do círculo com margem confortável
    const maxDim = L * 0.74;
    const fator = Math.min(maxDim / logo.width, maxDim / logo.height);
    const w = Math.max(1, Math.round(logo.width * fator));
    const h = Math.max(1, Math.round(logo.height * fator));
    const x = Math.round((L - w) / 2);
    const y = Math.round((L - h) / 2);

    ctx.save();
    ctx.beginPath();
    ctx.arc(r, r, r - 1, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(logo, 0, 0, logo.width, logo.height, x, y, w, h);
    ctx.restore();
  } else if (logoPadrao) {
    const maxDim = L * 0.74;
    const fator = Math.min(maxDim / logoPadrao.width, maxDim / logoPadrao.height);
    const w = Math.max(1, Math.round(logoPadrao.width * fator));
    const h = Math.max(1, Math.round(logoPadrao.height * fator));
    const x = Math.round((L - w) / 2);
    const y = Math.round((L - h) / 2);

    ctx.save();
    ctx.beginPath();
    ctx.arc(r, r, r - 1, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(logoPadrao, 0, 0, logoPadrao.width, logoPadrao.height, x, y, w, h);
    ctx.restore();
  } else {
    walletIcons.drawStampGlyph(ctx, estilo.stampIconKey, r, r, r * 0.55, estilo.inkColor);
  }
  return img;
}

async function pngDataUrl(bitmap) {
  return `data:image/png;base64,${(await bitmapToPngBuffer(bitmap)).toString('base64')}`;
}

module.exports = { FAIXA, LOGO, layoutFaixa, renderFaixaApple, renderLogoApple, pngDataUrl };
