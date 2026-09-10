import type { CardDesign, PalettePreset, StampIconKey } from './types.js';

export const STAMP_ICON_CATALOG: Array<{ key: StampIconKey; label: string; emoji: string }> = [
  { key: 'cookie', label: 'Cookie', emoji: '🍪' },
  { key: 'coffee', label: 'Café', emoji: '☕' },
  { key: 'star', label: 'Estrela', emoji: '⭐' },
  { key: 'heart', label: 'Coração', emoji: '❤️' },
  { key: 'sparkle', label: 'Brilho', emoji: '✨' },
  { key: 'fire', label: 'Fogo', emoji: '🔥' },
  { key: 'coin', label: 'Moeda', emoji: '🪙' },
  { key: 'gift', label: 'Presente', emoji: '🎁' },
];

export const PALETTES: PalettePreset[] = [
  {
    id: 'preto-mimo',
    name: 'Preto Mimo',
    swatch: '#FFC82C',
    colors: {
      background: '#141416',
      accent: '#FFC82C',
      text: '#FFFFFF',
      muted: '#9CA3AF',
      stampInk: '#141416',
    },
  },
  {
    id: 'cafe-nobre',
    name: 'Café Nobre',
    swatch: '#E5A950',
    colors: {
      background: '#1C140E',
      accent: '#E5A950',
      text: '#FFF8EF',
      muted: '#B79B7E',
      stampInk: '#1C140E',
    },
  },
  {
    id: 'esmeralda',
    name: 'Esmeralda',
    swatch: '#34D399',
    colors: {
      background: '#0B1F17',
      accent: '#34D399',
      text: '#ECFDF5',
      muted: '#7FA894',
      stampInk: '#06281C',
    },
  },
  {
    id: 'azul-noite',
    name: 'Azul Noite',
    swatch: '#60A5FA',
    colors: {
      background: '#0C1526',
      accent: '#60A5FA',
      text: '#EFF6FF',
      muted: '#8AA2C4',
      stampInk: '#0A1730',
    },
  },
  {
    id: 'rosa-doce',
    name: 'Rosa Doce',
    swatch: '#F472B6',
    colors: {
      background: '#1F0F19',
      accent: '#F472B6',
      text: '#FDF2F8',
      muted: '#C08BA6',
      stampInk: '#2A0E1D',
    },
  },
];

export const STAMP_TOTAL_OPTIONS = [5, 6, 8, 10, 12, 15];

export function createDefaultDesign(storeName = 'Minha Loja'): CardDesign {
  return {
    schemaVersion: 1,
    brand: {
      storeName,
      tagline: 'Programa de Fidelidade Digital',
      logoDataUrl: null,
      logoUrl: null,
    },
    colors: { ...PALETTES[0].colors },
    stamps: {
      total: 10,
      shape: 'circle',
      fill: 'number',
      iconKey: 'cookie',
      imageDataUrl: null,
      showNumbersOnEmpty: true,
      columns: 5,
    },
    reward: {
      label: 'Cookie Grátis',
      description: 'Apresente o QR Code e retire seu mimo.',
      iconKey: 'gift',
      imageDataUrl: null,
      color: '#FFC82C',
      validityDays: 30,
    },
    fields: {
      cliente: { enabled: true, label: 'CLIENTE' },
      faltam: { enabled: true, label: 'FALTAM' },
      mimo: { enabled: true, label: 'MIMO' },
      unidade: { enabled: true, label: 'UNIDADE', value: 'Matriz' },
      programa: { enabled: false, label: 'PROGRAMA' },
      status: { enabled: false, label: 'STATUS' },
      validade: { enabled: false, label: 'VALIDADE' },
    },
    qr: {
      enabled: true,
      format: 'mimo',
      showPassCode: true,
      label: 'Apresente no caixa para creditar o selo',
    },
    version: 'v1',
    updatedAt: new Date().toISOString(),
  };
}

/** Preenche lacunas de um design carregado (retrocompatibilidade de schema). */
export function normalizeDesign(partial: any, storeName?: string): CardDesign {
  const base = createDefaultDesign(storeName);
  if (!partial || typeof partial !== 'object') return base;
  return {
    ...base,
    ...partial,
    brand: { ...base.brand, ...(partial.brand || {}) },
    colors: { ...base.colors, ...(partial.colors || {}) },
    stamps: { ...base.stamps, ...(partial.stamps || {}) },
    reward: { ...base.reward, ...(partial.reward || {}) },
    fields: {
      cliente: { ...base.fields.cliente, ...(partial.fields?.cliente || {}) },
      faltam: { ...base.fields.faltam, ...(partial.fields?.faltam || {}) },
      mimo: { ...base.fields.mimo, ...(partial.fields?.mimo || {}) },
      unidade: { ...base.fields.unidade, ...(partial.fields?.unidade || {}) },
      programa: { ...base.fields.programa, ...(partial.fields?.programa || {}) },
      status: { ...base.fields.status, ...(partial.fields?.status || {}) },
      validade: { ...base.fields.validade, ...(partial.fields?.validade || {}) },
    },
    qr: { ...base.qr, ...(partial.qr || {}) },
    schemaVersion: 1,
  };
}
