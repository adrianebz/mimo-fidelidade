/**
 * Renderização da cartela de selos (banner) com PureImage.
 *
 * Compartilhada por dois consumidores:
 *  - generateBanner (heroImage da Google Wallet, 1032×336);
 *  - passe da Apple Wallet (strip.png do storeCard, 1125×432 = 375×144 pt @3x).
 *
 * O tamanho é parametrizado porque a Apple aplica "aspect fill" na strip: uma
 * imagem na proporção da Google (≈3:1) seria cortada nas laterais e os selos
 * das pontas sumiriam do cartão no iPhone.
 */
const { Readable, PassThrough } = require('stream');
const walletIcons = require('./wallet-icons');

function bufferToStream(buffer) {
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  return stream;
}

async function loadBase64Image(dataUrl) {
  if (!dataUrl || !String(dataUrl).includes('base64,')) return null;
  try {
    const PImage = require('pureimage');
    const isPng = dataUrl.includes('image/png');
    const isJpeg = dataUrl.includes('image/jpeg') || dataUrl.includes('image/jpg');
    if (!isPng && !isJpeg) return null;

    const b64Data = dataUrl.split(',')[1];
    const buffer = Buffer.from(b64Data, 'base64');
    const stream = bufferToStream(buffer);

    if (isPng) {
      return await PImage.decodePNGFromStream(stream);
    }
    return await PImage.decodeJPEGFromStream(stream);
  } catch (err) {
    console.warn('Erro ao carregar imagem base64:', err.message);
    return null;
  }
}

/** Codifica um bitmap do PureImage em PNG e devolve o Buffer. */
async function bitmapToPngBuffer(img) {
  const PImage = require('pureimage');
  const pass = new PassThrough();
  const chunks = [];
  pass.on('data', (c) => chunks.push(c));
  await PImage.encodePNGToStream(img, pass);
  return Buffer.concat(chunks);
}

/**
 * Estilo dos selos resolvido a partir da loja.
 *
 * O JSON do Estúdio (`design`) é a fonte de verdade; `layout` é o espelho
 * legado, mantido para lojas que ainda não passaram pelo Estúdio.
 */
function resolverEstiloSelos(lojaData) {
  const layout = lojaData.layout || {};
  const design = lojaData.design || null;
  const bgColor = design?.colors?.background || layout.corFundo || '#141416';
  const accentColor = design?.colors?.accent || layout.accentColor || '#FFC82C';
  const stampInk = design?.colors?.stampInk || layout.stampInk || bgColor;
  return {
    bgColor,
    accentColor,
    // O conteúdo do selo é desenhado sobre a cor de destaque, então a tinta
    // precisa contrastar com ela (e não com o fundo do cartão).
    inkColor: stampInk || walletIcons.contrastIconColor(accentColor),
    stampIconKey: String(design?.stamps?.iconKey || layout.stampIcon || 'cookie').toLowerCase(),
    stampShape: String(design?.stamps?.shape || layout.stampShape || 'circle').toLowerCase(),
    stampFill: String(design?.stamps?.fill || layout.stampFill || 'icon').toLowerCase(),
    showNumbersOnEmpty: design?.stamps?.showNumbersOnEmpty ?? layout.showNumbersOnEmpty ?? false,
    rewardColor: design?.reward?.color || layout.rewardColor || accentColor,
    rewardIconKey: String(design?.reward?.iconKey || layout.rewardIcon || 'gift').toLowerCase(),
  };
}

/** Imagens próprias do lojista para o selo comum e o selo do prêmio, se houver. */
async function carregarImagensSelos(lojaData) {
  const layout = lojaData.layout || {};
  const design = lojaData.design || null;
  let selo = null;
  let premio = null;
  const b64Stamp = design?.stamps?.imageDataUrl || layout.stampImageBase64 || layout.stampImage;
  if (b64Stamp && String(b64Stamp).startsWith('data:image')) selo = await loadBase64Image(b64Stamp);
  const b64Reward =
    design?.reward?.imageDataUrl || layout.rewardStampImageBase64 || layout.rewardStampImage;
  if (b64Reward && String(b64Reward).startsWith('data:image')) premio = await loadBase64Image(b64Reward);
  return { selo, premio };
}

/**
 * Desenha um selo da cartela.
 *
 * Compartilhado pelo banner da Google e pela faixa do passe Apple: os dois
 * precisam do mesmo traço, senão o mesmo cartão parece outro em cada carteira.
 *
 * As medidas que o banner da Google usava fixas em px (estrelinha do prêmio e
 * recuo das imagens dentro do selo) viram parâmetros: a Google segue com os
 * mesmos valores de antes, e a faixa da Apple passa valores proporcionais ao
 * raio, porque lá o tamanho do selo varia com a escala da imagem.
 *
 * @param {object} p
 * @param {number} p.raioBadge     raio da estrelinha do prêmio, em px
 * @param {number} p.recuoPremio   recuo da imagem do prêmio dentro do selo, em px
 * @param {number} p.recuoSelo     recuo da imagem do selo comum, em px
 * @param {boolean} p.semContorno  sem o anel escuro da "medalha": a imagem do
 *   selo ocupa o formato inteiro e os selos de ícone/número viram um disco
 *   liso. A Google mantém o anel (padrão), a faixa da Apple usa sem.
 */
function desenharSelo(ctx, {
  cx, cy, raio, posicao, conquistado, premio, estilo, imagens,
  raioBadge = 19, recuoPremio = 8, recuoSelo = 10, semContorno = false,
}) {
  const e = estilo;

  /** Base do selo: medalha com anel (Google) ou disco liso (Apple). */
  const base = (cor, apagado) => {
    if (!semContorno) {
      walletIcons.drawMedallionBase(ctx, cx, cy, raio, cor, apagado, e.stampShape);
      return;
    }
    const prev = ctx.globalAlpha;
    if (apagado) ctx.globalAlpha = 0.35;
    ctx.fillStyle = cor;
    walletIcons.shapePath(ctx, e.stampShape, cx, cy, raio);
    ctx.fill();
    ctx.globalAlpha = prev;
  };

  if (premio) {
    // Selo do prêmio: imagem própria do lojista, senão o ícone escolhido.
    // Com imagem e sem contorno, não há base: a imagem é o próprio selo.
    if (!(semContorno && imagens.premio)) base(e.rewardColor, !conquistado);
    const prevAlpha = ctx.globalAlpha;
    if (!conquistado) ctx.globalAlpha = 0.4;

    if (imagens.premio) {
      const r = semContorno ? raio : raio - recuoPremio;
      ctx.save();
      walletIcons.shapePath(ctx, e.stampShape, cx, cy, r);
      ctx.clip();
      ctx.drawImage(imagens.premio, cx - r, cy - r, r * 2, r * 2);
      ctx.restore();
    } else if (e.rewardIconKey === 'gift') {
      walletIcons.drawGiftIcon(ctx, cx, cy, raio, e.inkColor);
    } else {
      walletIcons.drawStampGlyph(ctx, e.rewardIconKey, cx, cy, raio * 0.62, e.inkColor);
    }
    ctx.globalAlpha = prevAlpha;

    walletIcons.drawStarBadge(ctx, cx + raio * 0.72, cy - raio * 0.72, raioBadge, e.rewardColor, !conquistado, semContorno);
  } else if (conquistado) {
    // Selo conquistado: fundo na cor do cartão (contraste com o painel) e,
    // dentro dele, o número, o ícone ou a imagem — conforme o Estúdio.
    const comImagem = e.stampFill === 'image' && imagens.selo;
    if (!(semContorno && comImagem)) base(e.bgColor, false);

    if (comImagem) {
      const r = semContorno ? raio : raio - recuoSelo;
      ctx.save();
      walletIcons.shapePath(ctx, e.stampShape, cx, cy, r);
      ctx.clip();
      ctx.drawImage(imagens.selo, cx - r, cy - r, r * 2, r * 2);
      ctx.restore();
    } else if (e.stampFill === 'number') {
      walletIcons.drawNumber(ctx, posicao, cx, cy, raio * 0.66, e.accentColor);
    } else {
      walletIcons.drawStampGlyph(ctx, e.stampIconKey, cx, cy, raio * 0.62, e.accentColor);
    }
  } else {
    if (semContorno) {
      // Selo vazio sem o anel: um disco liso, levemente mais escuro que o
      // painel, só o bastante para marcar a posição.
      ctx.fillStyle = walletIcons.withAlpha(e.inkColor, 0.16);
      walletIcons.shapePath(ctx, e.stampShape, cx, cy, raio);
      ctx.fill();
    } else {
      walletIcons.drawEmptySlot(ctx, cx, cy, raio, e.inkColor, e.stampShape, e.accentColor);
    }
    if (e.showNumbersOnEmpty) {
      walletIcons.drawNumber(ctx, posicao, cx, cy, raio * 0.58, walletIcons.withAlpha(e.inkColor, 0.55));
    }
  }
}

/**
 * Desenha a cartela de selos da loja (heroImage da Google Wallet).
 * @param {object} lojaData documento lojistas/{id}
 * @param {number} selos selos já conquistados no ciclo
 * @param {number|string|undefined} metaParam meta vinda da URL/cartão (opcional)
 * @param {number} W largura em px
 * @param {number} H altura em px
 */
async function renderStampBanner(lojaData, selos, metaParam, W = 1032, H = 336) {
  const PImage = require('pureimage');
  const layout = lojaData.layout || {};
  const design = lojaData.design || null;
  const estilo = resolverEstiloSelos(lojaData);
  const { bgColor, accentColor } = estilo;

  const meta = Math.max(
    1,
    Math.min(
      30,
      parseInt(String(metaParam || design?.stamps?.total || lojaData.regras?.meta || 10), 10) || 10
    )
  );

  const img = PImage.make(W, H);
  const ctx = img.getContext('2d');

  // Fundo principal na cor da loja (o mesmo hexBackgroundColor da loyaltyClass)
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, W, H);

  // Painel interno na cor de destaque, como a cartela do cartão de referência.
  // Só preenchimento: roundRect + stroke no pureimage fecha o traço errado e
  // deixa uma diagonal atravessando o painel.
  const margin = 20;
  ctx.fillStyle = accentColor;
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(margin, margin, W - margin * 2, H - margin * 2, 28);
    ctx.fill();
  } else {
    ctx.fillRect(margin, margin, W - margin * 2, H - margin * 2);
  }

  // Grade adapta-se à meta de selos configurada pelo lojista (não é fixa em 10)
  const colsConfig = Number(design?.stamps?.columns || layout.stampColumns || 5);
  const cols = Math.min(Math.max(3, colsConfig), meta);
  const rows = Math.ceil(meta / cols);
  // Raio limitado pelo espaço disponível, para caber qualquer combinação de
  // meta × colunas sem os selos vazarem para fora do painel.
  const padding = margin + 16;
  const maxByWidth = (W - padding * 2) / (cols * 2.35);
  const maxByHeight = (H - padding * 2) / (rows * 2.35);
  // Teto de 52px na altura original da Google (336px), proporcional nas demais.
  const radiusCap = 52 * Math.max(1, H / 336);
  const radius = Math.max(18, Math.min(radiusCap, maxByWidth, maxByHeight));

  const innerLeft = padding + radius;
  const innerRight = W - padding - radius;
  const innerTop = padding + radius;
  const innerBottom = H - padding - radius;

  const spacingX = cols > 1 ? (innerRight - innerLeft) / (cols - 1) : 0;
  const spacingY = rows > 1 ? (innerBottom - innerTop) / (rows - 1) : 0;
  const originX = cols > 1 ? innerLeft : W / 2;
  const originY = rows > 1 ? innerTop : H / 2;

  const imagens = await carregarImagensSelos(lojaData);

  for (let i = 0; i < meta; i++) {
    desenharSelo(ctx, {
      cx: originX + (i % cols) * spacingX,
      cy: originY + Math.floor(i / cols) * spacingY,
      raio: radius,
      posicao: i + 1,
      conquistado: i < selos,
      premio: i === meta - 1,
      estilo,
      imagens,
    });
  }

  return img;
}

module.exports = {
  bufferToStream,
  loadBase64Image,
  bitmapToPngBuffer,
  resolverEstiloSelos,
  carregarImagensSelos,
  desenharSelo,
  renderStampBanner,
};
