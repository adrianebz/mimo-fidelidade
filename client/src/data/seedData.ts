/**
 * Dados de inicialização e seed para demonstração e produção (Mimo Fidelidade)
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
  'padaria-da-ana': {
    nome: "Padaria da Ana",
    slug: "padaria-da-ana",
    ativo: true,
    statusFinanceiro: "inadimplente",
    financeiro: {
      status: "inadimplente",
      plano: "starter",
      valorMensal: 89.00,
      bloqueadoPorInadimplencia: true,
      proximoVencimento: "2026-08-30T00:00:00Z"
    },
    layout: {
      corFundo: "#1B4332",
      corTexto: "#FFFFFF",
      logoUrl: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=660&auto=format&fit=crop",
      heroUrl: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1032&auto=format&fit=crop",
      nomePrograma: "Clube da Ana",
      premio: "1 café grátis + pão na chapa"
    },
    regras: {
      meta: 10,
      intervaloMinimoMin: 30,
      maxSelosDiaPorCliente: 2,
      validadeDias: 180,
      exigirSMS: false
    },
    wallet: {
      classId: "3388000000012345678.padaria-da-ana",
      classSincronizadaEm: new Date().toISOString()
    },
    operadores: {
      "uid_ana": { nome: "Ana Silva", pin: "1234", papel: "dono" },
      "uid_balcao": { nome: "Balcão 1", pin: "1234", papel: "operador" },
      "operador-balcao": { nome: "Balcão Central", pin: "1234", papel: "operador" }
    },
    criadoEm: new Date().toISOString()
  },
  'casa-nuvem': {
    nome: "Casa Nuvem",
    slug: "casa-nuvem",
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
      logoUrl: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=660&auto=format&fit=crop",
      heroUrl: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=1032&auto=format&fit=crop",
      nomePrograma: "Mimo Nuvem",
      premio: "1 Café Filtrado Especial + Pão de Queijo Canastra"
    },
    regras: {
      meta: 10,
      intervaloMinimoMin: 30,
      maxSelosDiaPorCliente: 2,
      validadeDias: 180,
      exigirSMS: false
    },
    wallet: {
      classId: "3388000000012345678.casa-nuvem",
      classSincronizadaEm: new Date().toISOString()
    },
    operadores: {
      "uid_lia": { nome: "Lia Martins", pin: "1234", papel: "dono" },
      "operador-balcao": { nome: "Balcão Casa Nuvem", pin: "1234", papel: "operador" }
    },
    criadoEm: new Date().toISOString()
  }
};
