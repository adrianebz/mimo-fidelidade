import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase.js';
import { publicarIdentidadeVisual } from '../services/mimoWalletService.js';
import type { CardDesign } from './types.js';
import { createDefaultDesign, normalizeDesign } from './defaults.js';

const LOCAL_KEY = (slug: string) => `mimo_card_design_${slug}`;

/**
 * Converte o design para o formato `layout` legado, que é o que as Cloud
 * Functions (generateBanner/gerarSaveUrl) já sabem ler. Sem isso, o estúdio
 * mudaria só a prévia e o cartão real continuaria igual.
 */
export function designToLegacyConfig(design: CardDesign) {
  return {
    storeName: design.brand.storeName,
    tagline: design.brand.tagline,
    bgColor: design.colors.background,
    textColor: design.colors.text,
    accentColor: design.colors.accent,
    stampInk: design.colors.stampInk,
    stampIcon: design.stamps.iconKey,
    stampShape: design.stamps.shape,
    stampFill: design.stamps.fill,
    showNumbersOnEmpty: design.stamps.showNumbersOnEmpty,
    stampColumns: design.stamps.columns,
    meta: design.stamps.total,
    rewardTitle: design.reward.label,
    rewardDescription: design.reward.description,
    rewardColor: design.reward.color,
    rewardIcon: design.reward.iconKey,
    validityDays: String(design.reward.validityDays),
    storeLogoImage: design.brand.logoDataUrl || design.brand.logoUrl || '',
    stampImage: design.stamps.imageDataUrl || '',
    rewardStampImage: design.reward.imageDataUrl || '',
  };
}

/** Reconstrói um design a partir do `layout` legado (lojas antigas). */
function legacyLayoutToDesign(data: any): CardDesign {
  const layout = data?.layout || {};
  const base = createDefaultDesign(data?.nome || 'Minha Loja');
  return normalizeDesign({
    ...base,
    brand: {
      ...base.brand,
      storeName: data?.nome || base.brand.storeName,
      tagline: layout.nomePrograma || base.brand.tagline,
      logoDataUrl: layout.logoBase64 || null,
      logoUrl: layout.logoUrl || null,
    },
    colors: {
      ...base.colors,
      background: layout.corFundo || base.colors.background,
      text: layout.corTexto || base.colors.text,
      accent: layout.accentColor || base.colors.accent,
      stampInk: layout.stampInk || base.colors.stampInk,
    },
    stamps: {
      ...base.stamps,
      total: data?.regras?.meta || base.stamps.total,
      iconKey: layout.stampIcon || base.stamps.iconKey,
      imageDataUrl: layout.stampImageBase64 || layout.stampImage || null,
      fill: layout.stampImageBase64 || layout.stampImage ? 'image' : base.stamps.fill,
      perScan: data?.regras?.selosPorLeitura || base.stamps.perScan,
      maxPerScan: data?.regras?.maxSelosPorLeitura || base.stamps.maxPerScan,
    },
    reward: {
      ...base.reward,
      label: layout.premio || base.reward.label,
      description: layout.instrucaoResgate || base.reward.description,
      color: layout.rewardColor || layout.accentColor || base.reward.color,
      imageDataUrl: layout.rewardStampImageBase64 || layout.rewardStampImage || null,
      validityDays: Number(layout.validadeDias) || base.reward.validityDays,
    },
    version: layout.versao || base.version,
  });
}

/**
 * Carrega o design da loja. Prioriza o JSON novo (`design`); se a loja ainda
 * não passou pelo estúdio, converte o layout legado para não começar do zero.
 */
export async function loadDesign(slug: string): Promise<CardDesign> {
  try {
    const snap = await getDoc(doc(db, 'lojistas', slug));
    if (snap.exists()) {
      const data = snap.data();
      if (data.design && data.design.schemaVersion) {
        return normalizeDesign(data.design, data.nome);
      }
      return legacyLayoutToDesign(data);
    }
  } catch (err: any) {
    console.warn('Falha ao carregar design do Firestore, usando cache local:', err?.message);
  }

  if (typeof localStorage !== 'undefined') {
    const cached = localStorage.getItem(LOCAL_KEY(slug));
    if (cached) {
      try {
        return normalizeDesign(JSON.parse(cached));
      } catch {}
    }
  }
  return createDefaultDesign();
}

/** Salva rascunho localmente (não publica na carteira). */
export function saveDraft(slug: string, design: CardDesign) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_KEY(slug), JSON.stringify(design));
    }
  } catch {}
}

export interface PublishResult {
  sucesso: boolean;
  message: string;
  design: CardDesign;
  heroUrl?: string;
  logoUrl?: string;
  classId?: string;
}

/**
 * Publica o design: grava o JSON completo, espelha nos campos legados que as
 * Cloud Functions consomem e dispara a sincronização da classe na Google Wallet
 * (o trigger sincronizarClasse reage à gravação em lojistas/{slug}).
 */
export async function publishDesign(slug: string, design: CardDesign): Promise<PublishResult> {
  const versao = String(Date.now());
  const published: CardDesign = { ...design, version: versao, updatedAt: new Date().toISOString() };

  // 1. Espelha no layout legado + gera as URLs dinâmicas de logo/banner
  const legacy = designToLegacyConfig(published);
  const res = await publicarIdentidadeVisual(slug, { ...legacy, versao });

  // 2. Grava o JSON completo e a meta de selos usada pela emissão do cartão
  try {
    await setDoc(
      doc(db, 'lojistas', slug),
      {
        design: published,
        regras: {
          meta: published.stamps.total,
          // Espelhado em `regras` porque é lá que as Cloud Functions procuram
          // os limites de operação do balcão.
          selosPorLeitura: published.stamps.perScan,
          maxSelosPorLeitura: published.stamps.maxPerScan,
        },
        // setDoc com merge faz merge profundo de mapas aninhados, então estes
        // campos são acrescentados ao `layout` sem apagar o que já existe.
        // (Chave com ponto só vira caminho aninhado em updateDoc, não aqui.)
        layout: {
          stampShape: published.stamps.shape,
          stampFill: published.stamps.fill,
          showNumbersOnEmpty: published.stamps.showNumbersOnEmpty,
          stampColumns: published.stamps.columns,
          stampInk: published.colors.stampInk,
          rewardColor: published.reward.color,
          rewardIcon: published.reward.iconKey,
        },
        atualizadoEm: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err: any) {
    console.warn('Falha ao gravar o design completo no Firestore:', err?.message);
  }

  saveDraft(slug, published);

  return {
    sucesso: res.sucesso,
    message: res.message,
    design: published,
    heroUrl: res.heroUrl,
    logoUrl: res.logoUrl,
    classId: res.classId,
  };
}
