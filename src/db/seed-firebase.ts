/**
 * Seed script for Firestore database (Mimo Fidelidade)
 * Default merchant structure: Minha Loja with operators, items, and active loyalty cards
 */

export interface SeedMerchantData {
  nome: string;
  slug: string;
  ativo: boolean;
  layout: {
    corFundo: string;
    corTexto: string;
    logoUrl: string;
    heroUrl: string;
    nomePrograma: string;
    premio: string;
  };
  regras: {
    meta: number;
    intervaloMinimoMin: number;
    maxSelosDiaPorCliente: number;
    validadeDias: number;
    exigirSMS: boolean;
  };
  wallet: {
    classId: string;
    classSincronizadaEm: string;
  };
  operadores: Record<string, { nome: string; pin: string; papel: string }>;
  criadoEm: string;
}

export const SEED_MERCHANTS: Record<string, SeedMerchantData> = {
  'minha-loja': {
    nome: "Minha Loja",
    slug: "minha-loja",
    ativo: true,
    layout: {
      corFundo: "#141416",
      corTexto: "#FFFFFF",
      logoUrl: "",
      heroUrl: "",
      nomePrograma: "Clube Fidelidade",
      premio: "Recompensa Exclusiva (10º Selo)"
    },
    regras: {
      meta: 10,
      intervaloMinimoMin: 30,
      maxSelosDiaPorCliente: 2,
      validadeDias: 180,
      exigirSMS: false
    },
    wallet: {
      classId: "3388000000012345678.minha-loja",
      classSincronizadaEm: new Date().toISOString()
    },
    operadores: {
      "operador-balcao": { nome: "Operador de Balcão", pin: "1234", papel: "operador" }
    },
    criadoEm: new Date().toISOString()
  }
};
