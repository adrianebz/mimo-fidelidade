/**
 * Contrato único do design do cartão de fidelidade BOOMII.
 *
 * Este JSON é a fonte de verdade: alimenta a prévia em tempo real no estúdio,
 * é salvo no Firestore e é o mesmo objeto usado para gerar o passe real na
 * Apple Wallet e na Google Wallet. Nada na prévia pode depender de algo que
 * não esteja aqui — se aparece na prévia, precisa vir deste objeto.
 */

export type WalletTarget = 'google' | 'apple';

/** Formatos disponíveis para o selo. Precisam existir também no renderizador do servidor. */
export type StampShape = 'circle' | 'rounded' | 'square';

/** O que aparece dentro de um selo conquistado. */
export type StampFill = 'number' | 'icon' | 'image';

/**
 * Catálogo de ícones. Mantido em sincronia 1:1 com functions/wallet-icons.js —
 * qualquer chave nova precisa ter um desenho vetorial correspondente no servidor,
 * senão a prévia mostraria algo que o cartão real não consegue renderizar.
 */
export type StampIconKey =
  | 'cookie'
  | 'coffee'
  | 'star'
  | 'heart'
  | 'sparkle'
  | 'fire'
  | 'coin'
  | 'gift';

export interface BrandConfig {
  storeName: string;
  tagline: string;
  /** Logo em data URI (upload do lojista). Tem precedência sobre logoUrl. */
  logoDataUrl: string | null;
  /** Logo já hospedado (fallback quando não houve upload). */
  logoUrl: string | null;
}

export interface ColorsConfig {
  /** Fundo do cartão. */
  background: string;
  /** Cor de destaque: painel dos selos, selo conquistado, badges. */
  accent: string;
  /** Texto principal sobre o fundo do cartão. */
  text: string;
  /** Texto secundário / rótulos. */
  muted: string;
  /** Cor do conteúdo dentro do selo conquistado (número ou ícone). */
  stampInk: string;
}

export interface StampsConfig {
  /** Meta de selos do programa (5, 8, 10, 12...). */
  total: number;
  shape: StampShape;
  fill: StampFill;
  iconKey: StampIconKey;
  /** Imagem customizada do selo, em data URI. Usada quando fill === 'image'. */
  imageDataUrl: string | null;
  /** Mostra a numeração nos selos ainda não conquistados. */
  showNumbersOnEmpty: boolean;
  /** Colunas da grade de selos na prévia e no banner. */
  columns: number;
  /**
   * Quantos selos cada leitura credita por padrão. Serve como valor inicial
   * no balcão — útil para lojas em que uma compra sempre vale mais de um selo.
   */
  perScan: number;
  /**
   * Teto de selos por operação. Protege contra erro de digitação do operador:
   * sem ele, um "50" sem querer completaria a cartela do cliente de uma vez.
   */
  maxPerScan: number;
  /** Permite que o operador altere a quantidade na hora do atendimento. */
  allowOperatorOverride: boolean;
}

export interface RewardConfig {
  /** Texto do prêmio, ex.: "Cookie Grátis". */
  label: string;
  /** Instrução exibida no passe. */
  description: string;
  iconKey: StampIconKey;
  imageDataUrl: string | null;
  /** Cor do selo especial do prêmio (último da cartela). */
  color: string;
  validityDays: number;
}

export interface InfoField {
  enabled: boolean;
  label: string;
  /** Valor fixo, quando não vem do cliente (ex.: unidade da loja). */
  value?: string;
}

/**
 * Campos exibidos no corpo do passe. Cada um pode ser ligado/desligado
 * pelo lojista; os valores dinâmicos são preenchidos por cliente na emissão.
 */
export interface InfoFieldsConfig {
  cliente: InfoField;
  faltam: InfoField;
  recompensa: InfoField;
  unidade: InfoField;
  programa: InfoField;
  status: InfoField;
  validade: InfoField;
  /**
   * Número do ciclo atual (1º cartão, 2º cartão...). Desligado por padrão:
   * faz sentido para quem trata os ciclos como conquista, e vira ruído para
   * quem só quer a cartela corrente.
   */
  ciclo: InfoField;
}

/**
 * Ordem canônica dos campos no passe.
 *
 * Vale para a prévia do estúdio **e** para as Cloud Functions que montam o
 * passe real — as duas precisam produzir a mesma sequência, senão o lojista
 * configura uma coisa e o cliente recebe outra. Ver `montarCamposDoPasse` em
 * `functions/pass-fields.js`, que implementa esta mesma ordem.
 */
export const ORDEM_CAMPOS: Array<keyof InfoFieldsConfig> = [
  'cliente',
  'recompensa',
  'faltam',
  'ciclo',
  'unidade',
  'programa',
  'status',
  'validade',
];

export interface QrConfig {
  enabled: boolean;
  /** 'boomii' gera "BOOMII:{cartaoId}:{totp}"; 'url' aponta para a cartela web. */
  format: 'boomii' | 'url';
  /** Exibe o código alfanumérico abaixo do QR (ex.: BOOMII-PASS-MA01). */
  showPassCode: boolean;
  label: string;
}

export interface CardDesign {
  schemaVersion: 1;
  brand: BrandConfig;
  colors: ColorsConfig;
  stamps: StampsConfig;
  reward: RewardConfig;
  fields: InfoFieldsConfig;
  qr: QrConfig;
  /** Versão incrementada a cada publicação — invalida o cache de imagem na Wallet. */
  version: string;
  updatedAt: string;
}

/** Dados do cliente usados para materializar o design num cartão concreto. */
export interface CardHolderData {
  nome: string;
  selos: number;
  cartaoId: string;
  passCode: string;
  unidade?: string;
  status?: string;
  /** Ciclo corrente (1 = primeira cartela). Exibido só se `fields.ciclo` estiver ligado. */
  ciclo?: number;
}

export interface PalettePreset {
  id: string;
  name: string;
  swatch: string;
  colors: ColorsConfig;
}
