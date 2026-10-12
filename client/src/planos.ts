/**
 * Espelho de functions/planos.js para o painel.
 *
 * Serve só para EXIBIR: cadeados, avisos de upgrade, nome do plano. Quem
 * decide de verdade é o servidor — mudar algo aqui não libera recurso nenhum.
 * Mantenha as duas listas iguais.
 */
export type Plano = 'essencial' | 'pro' | 'completo';

export type Recurso =
  | 'variosSelosPorLeitura'
  | 'estudioCompleto'
  | 'avisoNovoSelo'
  | 'avisoQuaseLa'
  | 'avisoAniversario'
  | 'avisoLembrete'
  | 'textosPersonalizados'
  | 'envioManual'
  | 'indicadoresAvancados'
  | 'fichaCliente'
  | 'exportarClientes'
  | 'filiais'
  | 'operadores'
  | 'campanhas'
  | 'semMarca';

export const ORDEM_PLANOS: Plano[] = ['essencial', 'pro', 'completo'];

export const NOME_PLANO: Record<Plano, string> = {
  essencial: 'Essencial',
  pro: 'Pro',
  completo: 'Completo',
};

export const PRECO_PLANO: Record<Plano, number> = { essencial: 69, pro: 149, completo: 279 };
export const PRECO_UNIDADE_EXTRA = 79;
export const UNIDADES_INCLUIDAS = 1;

const PRO: Record<Recurso, boolean> = {
  variosSelosPorLeitura: true,
  estudioCompleto: true,
  avisoNovoSelo: true,
  avisoQuaseLa: true,
  avisoAniversario: true,
  avisoLembrete: true,
  textosPersonalizados: true,
  envioManual: true,
  indicadoresAvancados: true,
  fichaCliente: true,
  exportarClientes: false,
  filiais: false,
  operadores: false,
  campanhas: false,
  semMarca: false,
};

export const RECURSOS: Record<Plano, Record<Recurso, boolean>> = {
  essencial: Object.fromEntries(Object.keys(PRO).map((k) => [k, false])) as Record<Recurso, boolean>,
  pro: PRO,
  completo: Object.fromEntries(Object.keys(PRO).map((k) => [k, true])) as Record<Recurso, boolean>,
};

/** Mesmas regras do servidor: nomes antigos aceitos; sem plano gravado = Pro. */
export function normalizarPlano(bruto?: string | null): Plano {
  const p = String(bruto || '').toLowerCase().trim();
  if (['essencial', 'starter', 'balcao', 'basico'].includes(p)) return 'essencial';
  if (['completo', 'rede', 'marca', 'unlimited', 'enterprise'].includes(p)) return 'completo';
  return 'pro';
}

export function temRecurso(plano: Plano, recurso: Recurso): boolean {
  return RECURSOS[plano][recurso];
}

/** Menor plano que libera o recurso, para o texto "Disponível no plano X". */
export function planoMinimo(recurso: Recurso): Plano {
  return ORDEM_PLANOS.find((p) => RECURSOS[p][recurso]) || 'completo';
}
