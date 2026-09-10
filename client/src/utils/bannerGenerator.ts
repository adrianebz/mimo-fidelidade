import { storage } from '../firebase.js';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export interface BannerConfig {
  bgColor?: string;
  accentColor?: string;
  stampIcon?: string;
  stampImage?: string | null;
  rewardTitle?: string;
  rewardStampImage?: string | null;
  stampsFilled?: number;
}

/**
 * Carrega uma imagem base64 ou URL em um elemento HTMLImageElement
 */
function carregarImagem(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

/**
 * Renderiza o banner oficial 1032x400 do Google Wallet com 10 posições circulares (grid 2x5),
 * moedas douradas dos selos 1-9 e o 10º selo especial do prêmio com estrela flutuante.
 */
export async function generateWalletHeroBanner(config: BannerConfig): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = 1032;
  canvas.height = 400;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Não foi possível obter contexto 2D do canvas');

  const bgColor = config.bgColor || '#141416';
  const stampsFilled = typeof config.stampsFilled === 'number' ? config.stampsFilled : 4;
  const rewardTitle = (config.rewardTitle || 'BROWNIE COOKIE GRÁTIS').toUpperCase();

  // 1. Fundo dark premium com gradiente sutil
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, 1032, 400);

  // Gradiente radial de iluminação central
  const bgGrad = ctx.createRadialGradient(516, 200, 50, 516, 200, 500);
  bgGrad.addColorStop(0, 'rgba(255, 255, 255, 0.05)');
  bgGrad.addColorStop(0.6, 'rgba(0, 0, 0, 0.2)');
  bgGrad.addColorStop(1, 'rgba(0, 0, 0, 0.6)');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 1032, 400);

  // Borda suave interna
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, 1030, 398);

  // Pré-carrega imagens se existirem
  let customStampImg: HTMLImageElement | null = null;
  if (config.stampImage) {
    try {
      customStampImg = await carregarImagem(config.stampImage);
    } catch (e) {
      console.warn('Erro ao carregar stampImage customizada:', e);
    }
  }

  let customRewardImg: HTMLImageElement | null = null;
  if (config.rewardStampImage) {
    try {
      customRewardImg = await carregarImagem(config.rewardStampImage);
    } catch (e) {
      console.warn('Erro ao carregar rewardStampImage customizada:', e);
    }
  }

  // 2. Posicionamento das 10 posições em 2 linhas de 5 colunas
  const radius = 54;
  const colCenters = [216, 366, 516, 666, 816];
  const rowCenters = [135, 270];

  for (let index = 0; index < 10; index++) {
    const slotNum = index + 1;
    const colIndex = index % 5;
    const rowIndex = Math.floor(index / 5);
    const cx = colCenters[colIndex];
    const cy = rowCenters[rowIndex];
    const isFilled = slotNum <= stampsFilled;
    const is10th = slotNum === 10;

    if (is10th) {
      // ══════════════════════════════════════════════════════════════
      // 10º SELO DO PRÊMIO: Círculo Amarelo/Dourado Sólido com Estrela ⭐
      // ══════════════════════════════════════════════════════════════
      ctx.save();

      // Círculo base da cor de destaque do lojista (ou amarelo ouro)
      const accent = config.accentColor || '#FFC82C';
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = accent;
      ctx.shadowColor = accent + '66';
      ctx.shadowBlur = 18;
      ctx.fill();

      // Borda do círculo
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 3.5;
      ctx.stroke();
      ctx.shadowBlur = 0;

      if (customRewardImg) {
        // Imagem personalizada do prêmio
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, radius - 8, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(customRewardImg, cx - (radius - 8), cy - (radius - 8), (radius - 8) * 2, (radius - 8) * 2);
        ctx.restore();
      } else {
        // Texto do prêmio em caixa alta centralizado
        ctx.fillStyle = '#09090B';
        ctx.font = '900 15px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const words = rewardTitle.split(' ');
        if (words.length <= 2) {
          ctx.fillText(words[0] || '', cx, cy - 8);
          ctx.fillText(words[1] || '', cx, cy + 10);
        } else if (words.length === 3) {
          ctx.fillText(words[0], cx, cy - 14);
          ctx.fillText(words[1], cx, cy);
          ctx.fillText(words[2], cx, cy + 14);
        } else {
          // Quebra em 3 linhas
          const l1 = words.slice(0, 2).join(' ');
          const l2 = words.slice(2, 4).join(' ');
          const l3 = words.slice(4).join(' ');
          ctx.font = '900 13px system-ui, -apple-system, sans-serif';
          ctx.fillText(l1, cx, cy - 14);
          ctx.fillText(l2, cx, cy);
          if (l3) ctx.fillText(l3, cx, cy + 14);
        }
      }

      // Estrela flutuante no canto superior direito
      const starX = cx + radius * 0.72;
      const starY = cy - radius * 0.72;
      const starR = 19;

      ctx.beginPath();
      ctx.arc(starX, starY, starR, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
      ctx.shadowBlur = 6;
      ctx.fill();

      ctx.strokeStyle = '#FDE047';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Desenha o caractere da estrela dourada
      ctx.fillStyle = '#F59E0B';
      ctx.font = '16px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⭐', starX, starY + 1);

      ctx.restore();
    } else if (isFilled) {
      // ══════════════════════════════════════════════════════════════
      // SELOS 1 A 9 PREENCHIDOS: Medalha / Moeda Dourada em Relevo
      // ══════════════════════════════════════════════════════════════
      ctx.save();

      // Borda externa com chanfro metálico dourado
      const rimGrad = ctx.createLinearGradient(cx, cy - radius, cx, cy + radius);
      rimGrad.addColorStop(0, '#FFE57F');
      rimGrad.addColorStop(0.3, '#F59E0B');
      rimGrad.addColorStop(0.7, '#D97706');
      rimGrad.addColorStop(1, '#78350F');

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = rimGrad;
      ctx.shadowColor = 'rgba(245, 158, 11, 0.4)';
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Face interna da moeda metálica
      const faceGrad = ctx.createRadialGradient(cx - 10, cy - 10, 5, cx, cy, radius - 6);
      faceGrad.addColorStop(0, '#F59E0B');
      faceGrad.addColorStop(0.6, '#B45309');
      faceGrad.addColorStop(1, '#78350F');

      ctx.beginPath();
      ctx.arc(cx, cy, radius - 5, 0, Math.PI * 2);
      ctx.fillStyle = faceGrad;
      ctx.fill();

      // Anel decorativo dourado interno fino
      ctx.strokeStyle = 'rgba(254, 243, 199, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      if (customStampImg) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, radius - 10, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(customStampImg, cx - (radius - 10), cy - (radius - 10), (radius - 10) * 2, (radius - 10) * 2);
        ctx.restore();
      } else {
        // Ícone escolhido pelo lojista (Cookie, Café, Estrela, etc.)
        let emoji = '🍪';
        if (config.stampIcon === 'coffee') emoji = '☕';
        else if (config.stampIcon === 'star') emoji = '⭐';
        else if (config.stampIcon === 'heart') emoji = '❤️';
        else if (config.stampIcon === 'sparkle') emoji = '✨';
        else if (config.stampIcon === 'fire') emoji = '🔥';
        else if (config.stampIcon === 'coin') emoji = '🪙';
        else if (config.stampIcon) emoji = config.stampIcon;

        ctx.font = '38px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(emoji, cx, cy + 2);
      }

      ctx.restore();
    } else {
      // ══════════════════════════════════════════════════════════════
      // SELOS 1 A 9 VAZIOS: Círculo translúcido com borda suave
      // ══════════════════════════════════════════════════════════════
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Número sutil do slot
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(slotNum), cx, cy);

      ctx.restore();
    }
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Falha ao exportar canvas para Blob'));
    }, 'image/png');
  });
}

/**
 * Executa uma Promise com tempo limite (timeout) para evitar travamento em uploads de rede
 */
function withTimeout<T>(promise: Promise<T>, ms: number, fallbackValue: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallbackValue), ms))
  ]);
}

/**
 * Gera e faz upload do banner oficial para o Firebase Storage
 * Retorna a URL pública de download pronta para ser usada como heroImage na Google Wallet
 */
export async function uploadCustomWalletBanner(
  lojaSlug: string,
  config: BannerConfig
): Promise<string> {
  const isZero = (config.stampsFilled ?? 0) === 0;
  const fallbackUrl = isZero 
    ? 'https://mimo-fidelidade.web.app/banners/hero-0.jpg'
    : 'https://mimo-fidelidade.web.app/banners/hero-4.jpg';

  try {
    const blob = await withTimeout(generateWalletHeroBanner(config), 2000, null);
    if (!blob) return fallbackUrl;

    const slug = (lojaSlug || 'loja').toLowerCase().trim();
    const filename = `banner_wallet_${Date.now()}.png`;
    const storageRef = ref(storage, `lojistas/${slug}/${filename}`);

    const uploadOp = async () => {
      await uploadBytes(storageRef, blob, { contentType: 'image/png' });
      return await getDownloadURL(storageRef);
    };

    return await withTimeout(uploadOp(), 2500, fallbackUrl);
  } catch (err: any) {
    console.warn('Upload de banner para Firebase Storage falhou (usando fallback estático):', err?.message || err);
    return fallbackUrl;
  }
}

/**
 * Gera e faz upload do logo da loja para o Firebase Storage se necessário
 */
export async function uploadCustomWalletLogo(
  lojaSlug: string,
  _storeName: string,
  logoDataUrl?: string | null
): Promise<string> {
  const slug = (lojaSlug || 'loja').toLowerCase().trim();
  const fallbackUrl = slug === 'nox-dessert-club' || slug === 'nox_dessert_club'
    ? 'https://mimo-fidelidade.web.app/logos/nox-dessert-club.jpg'
    : `https://mimo-fidelidade.web.app/logos/${slug}.jpg`;

  if (logoDataUrl && logoDataUrl.startsWith('data:image')) {
    try {
      const uploadOp = async () => {
        const res = await fetch(logoDataUrl);
        const blob = await res.blob();
        const storageRef = ref(storage, `lojistas/${slug}/logo_${Date.now()}.png`);
        await uploadBytes(storageRef, blob, { contentType: blob.type || 'image/png' });
        return await getDownloadURL(storageRef);
      };

      return await withTimeout(uploadOp(), 2500, fallbackUrl);
    } catch (err: any) {
      console.warn('Upload de logo para Storage falhou:', err);
      return fallbackUrl;
    }
  } else if (logoDataUrl && logoDataUrl.startsWith('http')) {
    return logoDataUrl;
  }

  return fallbackUrl;
}
