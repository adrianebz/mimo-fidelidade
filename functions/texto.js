/**
 * Texto em imagens geradas no servidor (faixa e logo do passe Apple).
 *
 * Não usa o `fillText` do PureImage de propósito. A Montserrat estática tem
 * contornos sobrepostos (haste e travessa do "t", haste e bojo do "b") e o
 * PureImage preenche esses contornos com uma regra que abre buracos onde eles
 * se cruzam — o texto saía com entalhes e faixas escuras dentro das letras,
 * visíveis no iPhone em @3x.
 *
 * Aqui os contornos vêm do opentype.js e são rasterizados com a regra do
 * enrolamento não nulo (a mesma do navegador), com antisserrilhamento por
 * subamostragem vertical e cobertura horizontal exata.
 */
const fs = require('fs');
const path = require('path');
const opentype = require('opentype.js');

const ARQUIVOS = {
  bold: path.join(__dirname, 'assets', 'fonts', 'Montserrat-Bold.ttf'),
};

const fontes = {};
function fonte(peso = 'bold') {
  if (!fontes[peso]) {
    const buf = fs.readFileSync(ARQUIVOS[peso]);
    fontes[peso] = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  }
  return fontes[peso];
}

/** Posição de cada glifo, com kerning e espaçamento entre letras (em fração do tamanho). */
function posicionar(f, texto, tamanho, tracking) {
  const escala = tamanho / f.unitsPerEm;
  const glifos = f.stringToGlyphs(texto);
  const posicoes = [];
  let x = 0;
  for (let i = 0; i < glifos.length; i++) {
    const g = glifos[i];
    posicoes.push({ g, x });
    let avanco = (g.advanceWidth || 0) * escala;
    if (i < glifos.length - 1) {
      if (typeof f.getKerningValue === 'function') avanco += f.getKerningValue(g, glifos[i + 1]) * escala;
      avanco += tamanho * tracking;
    }
    x += avanco;
  }
  return { posicoes, largura: x };
}

function medirTexto(texto, tamanho, { tracking = 0, peso = 'bold' } = {}) {
  return posicionar(fonte(peso), texto, tamanho, tracking).largura;
}

/**
 * Reduz o corpo até caber em `larguraMax`; se nem no mínimo couber, corta com
 * reticências. Devolve o texto final e o corpo usado.
 */
function ajustarTexto(texto, larguraMax, tamanho, tamanhoMin, opcoes = {}) {
  let t = tamanho;
  while (t > tamanhoMin && medirTexto(texto, t, opcoes) > larguraMax) t -= 0.25;
  if (medirTexto(texto, t, opcoes) <= larguraMax) return { texto, tamanho: t };
  let s = texto;
  while (s.length > 1 && medirTexto(`${s}…`, t, opcoes) > larguraMax) s = s.slice(0, -1);
  return { texto: `${s.trimEnd()}…`, tamanho: t };
}

/** Converte os comandos de caminho do opentype em polígonos (curvas achatadas). */
function achatar(comandos) {
  const poligonos = [];
  let atual = null;
  let px = 0, py = 0, sx = 0, sy = 0;

  const fechar = () => {
    if (atual && atual.length > 2) poligonos.push(atual);
    atual = null;
  };
  const passos = (comprimento) => Math.max(2, Math.min(40, Math.ceil(comprimento / 1.5)));

  for (const c of comandos) {
    if (c.type === 'M') {
      fechar();
      atual = [[c.x, c.y]];
      px = sx = c.x; py = sy = c.y;
    } else if (c.type === 'L') {
      atual.push([c.x, c.y]);
      px = c.x; py = c.y;
    } else if (c.type === 'Q') {
      const n = passos(Math.hypot(c.x1 - px, c.y1 - py) + Math.hypot(c.x - c.x1, c.y - c.y1));
      for (let i = 1; i <= n; i++) {
        const t = i / n, u = 1 - t;
        atual.push([u * u * px + 2 * u * t * c.x1 + t * t * c.x, u * u * py + 2 * u * t * c.y1 + t * t * c.y]);
      }
      px = c.x; py = c.y;
    } else if (c.type === 'C') {
      const n = passos(
        Math.hypot(c.x1 - px, c.y1 - py) + Math.hypot(c.x2 - c.x1, c.y2 - c.y1) + Math.hypot(c.x - c.x2, c.y - c.y2)
      );
      for (let i = 1; i <= n; i++) {
        const t = i / n, u = 1 - t;
        atual.push([
          u * u * u * px + 3 * u * u * t * c.x1 + 3 * u * t * t * c.x2 + t * t * t * c.x,
          u * u * u * py + 3 * u * u * t * c.y1 + 3 * u * t * t * c.y2 + t * t * t * c.y,
        ]);
      }
      px = c.x; py = c.y;
    } else if (c.type === 'Z') {
      fechar();
      px = sx; py = sy;
    }
  }
  fechar();
  return poligonos;
}

/** Soma cobertura horizontal exata de um vão [xa, xb) numa linha de pixels. */
function cobrir(cobertura, W, linha, xa, xb, peso) {
  if (xb <= 0 || xa >= W) return;
  xa = Math.max(0, xa);
  xb = Math.min(W, xb);
  const ia = Math.floor(xa);
  const ib = Math.floor(xb);
  const base = linha * W;
  if (ia === ib) {
    cobertura[base + ia] += (xb - xa) * peso;
    return;
  }
  cobertura[base + ia] += (ia + 1 - xa) * peso;
  for (let i = ia + 1; i < ib; i++) cobertura[base + i] += peso;
  if (ib < W) cobertura[base + ib] += (xb - ib) * peso;
}

/** Rasteriza polígonos com a regra do enrolamento não nulo. */
function rasterizar(poligonos, x0, y0, W, H, sub = 5) {
  const cobertura = new Float32Array(W * H);
  const arestas = [];
  for (const p of poligonos) {
    for (let i = 0; i < p.length; i++) {
      const [ax, ay] = p[i];
      const [bx, by] = p[(i + 1) % p.length];
      if (ay === by) continue;
      const desce = by > ay;
      const [ya, yb, xa] = desce ? [ay, by, ax] : [by, ay, bx];
      arestas.push({ ya: ya - y0, yb: yb - y0, xa: xa - x0, k: (desce ? bx - ax : ax - bx) / (yb - ya), dir: desce ? 1 : -1 });
    }
  }

  const cortes = [];
  for (let linha = 0; linha < H; linha++) {
    for (let s = 0; s < sub; s++) {
      const y = linha + (s + 0.5) / sub;
      cortes.length = 0;
      for (const a of arestas) {
        if (y >= a.ya && y < a.yb) cortes.push([a.xa + (y - a.ya) * a.k, a.dir]);
      }
      if (cortes.length < 2) continue;
      cortes.sort((p, q) => p[0] - q[0]);
      let enrolamento = 0;
      let inicio = 0;
      for (const [x, dir] of cortes) {
        const antes = enrolamento;
        enrolamento += dir;
        if (antes === 0 && enrolamento !== 0) inicio = x;
        else if (antes !== 0 && enrolamento === 0) cobrir(cobertura, W, linha, inicio, x, 1 / sub);
      }
    }
  }
  return cobertura;
}

function hexParaRgb(hex) {
  const limpo = String(hex || '#000000').replace('#', '');
  const cheio = limpo.length === 3 ? limpo.split('').map((c) => c + c).join('') : limpo.slice(0, 6);
  return {
    r: parseInt(cheio.slice(0, 2), 16) || 0,
    g: parseInt(cheio.slice(2, 4), 16) || 0,
    b: parseInt(cheio.slice(4, 6), 16) || 0,
  };
}

/**
 * Desenha texto num bitmap do PureImage, compondo "por cima" com alfa correto
 * (o logo tem fundo transparente; a faixa, opaco).
 *
 * @returns {number} largura desenhada, em px
 */
function desenharTexto(bitmap, texto, { x, yBase, tamanho, cor, tracking = 0, peso = 'bold', opacidade = 1 }) {
  if (!texto) return 0;
  const f = fonte(peso);
  const { posicoes, largura } = posicionar(f, texto, tamanho, tracking);
  const escala = tamanho / f.unitsPerEm;

  const comandos = [];
  for (const { g, x: gx } of posicoes) {
    comandos.push(...g.getPath(x + gx, yBase, tamanho).commands);
  }
  const poligonos = achatar(comandos);

  const x0 = Math.floor(x) - 2;
  const y0 = Math.floor(yBase - f.ascender * escala) - 2;
  const W = Math.ceil(largura + tamanho * 0.2) + 4;
  const H = Math.ceil((f.ascender - f.descender) * escala) + 4;
  const cobertura = rasterizar(poligonos, x0, y0, W, H);

  const { r, g, b } = hexParaRgb(cor);
  const dados = bitmap.data;
  for (let ty = 0; ty < H; ty++) {
    const dy = y0 + ty;
    if (dy < 0 || dy >= bitmap.height) continue;
    for (let tx = 0; tx < W; tx++) {
      const a = Math.min(1, cobertura[ty * W + tx]) * opacidade;
      if (a <= 0) continue;
      const dx = x0 + tx;
      if (dx < 0 || dx >= bitmap.width) continue;
      const i = (dy * bitmap.width + dx) * 4;
      const da = dados[i + 3] / 255;
      const oa = a + da * (1 - a);
      dados[i] = Math.round((r * a + dados[i] * da * (1 - a)) / oa);
      dados[i + 1] = Math.round((g * a + dados[i + 1] * da * (1 - a)) / oa);
      dados[i + 2] = Math.round((b * a + dados[i + 2] * da * (1 - a)) / oa);
      dados[i + 3] = Math.round(oa * 255);
    }
  }
  return largura;
}

/** Altura de maiúsculas, para alinhar texto em caixa alta pelo topo. */
function alturaMaiusculas(tamanho, peso = 'bold') {
  // Mede pelo próprio contorno do "H": o caminho tem y para baixo, então a
  // altura das maiúsculas é o menor y negado. Não depende de getBoundingBox,
  // que não existe na versão do opentype.js trazida pelo PureImage.
  const f = fonte(peso);
  const comandos = f.charToGlyph('H').getPath(0, 0, tamanho).commands;
  let minY = 0;
  for (const c of comandos) if (typeof c.y === 'number' && c.y < minY) minY = c.y;
  return -minY;
}

module.exports = { medirTexto, ajustarTexto, desenharTexto, alturaMaiusculas };
