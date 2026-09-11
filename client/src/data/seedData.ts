/**
 * Dados de inicialização e estrutura base (Mimo Fidelidade)
 * Suporte a status financeiro ('adimplente' | 'inadimplente') e parametrização de planos.
 */

export interface SeedMerchantData {
  nome: string;
  slug: string;
  ativo: boolean;
  statusFinanceiro: 'adimplente' | 'inadimplente';
  financeiro: {
    status: 'adimplente' | 'inadimplente';
    plano: 'starter' | 'pro' | 'rede';
    valorMensal: number;
    bloqueadoPorInadimplencia: boolean;
    proximoVencimento?: string;
  };
  layout: {
    corFundo: string;
    corTexto: string;
    accentColor?: string;
    logoUrl: string;
    heroUrl: string;
    nomePrograma: string;
    premio: string;
    validadeDias?: number | string;
    instrucaoResgate?: string;
    stampIcon?: string;
    stampImage?: string | null;
    rewardStampImage?: string | null;
    versao?: string;
  };
  regras: {
    meta: number;
    intervaloMinimoMin: number;
    maxSelosDiaPorCliente: number;
    validadeDias: number;
    exigirSMS: boolean;
    /** Selos creditados por atendimento, por padrão. */
    selosPorLeitura?: number;
    /** Teto de selos por atendimento (trava contra erro do operador). */
    maxSelosPorLeitura?: number;
  };
  wallet: {
    classId: string;
    classSincronizadaEm: string;
  };
  operadores: Record<string, { nome: string; pin: string; papel: string }>;
  criadoEm: string;
  /** JSON completo do Estúdio de Cartões, quando a loja já publicou por lá. */
  design?: any;
}

export const SEED_MERCHANTS: Record<string, SeedMerchantData> = {
  'minha-loja': {
    nome: "Minha Loja",
    slug: "minha-loja",
    ativo: true,
    statusFinanceiro: "adimplente",
    financeiro: {
      status: "adimplente",
      plano: "pro",
      valorMensal: 149.00,
      bloqueadoPorInadimplencia: false,
      proximoVencimento: "2026-10-10T00:00:00Z"
    },
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
      classId: "3388000000023184117.fidelidade",
      classSincronizadaEm: new Date().toISOString()
    },
    operadores: {
      "operador-balcao": { nome: "Operador de Balcão", pin: "1234", papel: "operador" }
    },
    criadoEm: new Date().toISOString()
  }
};
