/**
 * Montagem dos campos do passe a partir da configuração do Estúdio de Marca.
 *
 * Espelha `client/src/wallet-studio/passFields.ts` — mesma ordem, mesmos
 * valores, mesmos rótulos. **Alterar um exige alterar o outro**, senão o
 * lojista configura uma coisa na prévia e o cliente recebe outra na carteira.
 *
 * Antes deste módulo, as funções escreviam rótulos fixos no código
 * ("CLIENTE VIP", "STATUS", "PRÊMIO") e liam de `loja.layout`/`loja.regras`,
 * ignorando `loja.design.fields`, que é onde o Estúdio grava o que o lojista
 * ligou, desligou e renomeou.
 */

/** Ordem canônica. Idêntica a ORDEM_CAMPOS do contrato no cliente. */
const ORDEM_CAMPOS = [
  'cliente',
  'recompensa',
  'faltam',
  'ciclo',
  'unidade',
  'programa',
  'status',
  'validade',
];

/** Usados quando a loja nunca publicou pelo Estúdio (só tem `layout` legado). */
const CAMPOS_PADRAO = {
  cliente: { enabled: true, label: 'CLIENTE' },
  recompensa: { enabled: true, label: 'RECOMPENSA' },
  faltam: { enabled: true, label: 'FALTAM' },
  ciclo: { enabled: false, label: 'CICLO' },
  unidade: { enabled: true, label: 'UNIDADE', value: 'Matriz' },
  programa: { enabled: false, label: 'PROGRAMA' },
  status: { enabled: false, label: 'STATUS' },
  validade: { enabled: false, label: 'VALIDADE' },
};

/**
 * Resolve a configuração de campos de uma loja.
 *
 * `design.fields` tem precedência; o que faltar cai no padrão. Lojas antigas,
 * que só têm `layout`, seguem funcionando com o conjunto padrão.
 */
function resolverCampos(loja) {
  const doDesign = (loja && loja.design && loja.design.fields) || {};
  const resolvidos = {};
  for (const chave of ORDEM_CAMPOS) {
    resolvidos[chave] = Object.assign({}, CAMPOS_PADRAO[chave], doDesign[chave] || {});
  }
  return resolvidos;
}

/**
 * Produz a lista de campos visíveis do passe.
 *
 * @param {object} loja   Documento de `lojistas/{id}`.
 * @param {object} dados  Dados do cartão: { nome, selos, meta, recompensa,
 *                        tagline, unidade, status, ciclo, validadeDias }.
 * @returns {Array<{chave: string, rotulo: string, valor: string}>}
 */
function montarCamposDoPasse(loja, dados) {
  const campos = resolverCampos(loja);
  const meta = dados.meta || 10;
  const selos = dados.selos || 0;
  const faltam = Math.max(0, meta - selos);
  const completo = faltam === 0;

  const valorPorCampo = {
    cliente: () => dados.nome || 'Cliente',
    recompensa: () => dados.recompensa || '',
    faltam: () => (completo ? 'Cartela completa' : `${faltam} ${faltam === 1 ? 'selo' : 'selos'}`),
    ciclo: () => `${dados.ciclo || 1}º cartão`,
    unidade: () => dados.unidade || campos.unidade.value || 'Matriz',
    programa: () => dados.tagline || '',
    status: () => dados.status || (completo ? 'Completo' : 'Ativo'),
    validade: () => `${dados.validadeDias || 30} dias após completar`,
  };

  return ORDEM_CAMPOS.filter((chave) => campos[chave] && campos[chave].enabled)
    .map((chave) => ({
      chave,
      // Sempre o rótulo que o lojista digitou, nunca um texto fixo.
      rotulo: campos[chave].label,
      valor: valorPorCampo[chave](),
    }))
    .filter((campo) => campo.valor !== '');
}

/** Converte os campos em `textModulesData` da Google Wallet. */
function paraTextModules(campos) {
  return campos.map((campo) => ({
    id: `campo_${campo.chave}`,
    header: campo.rotulo,
    body: campo.valor,
  }));
}

/**
 * Converte os campos em `infoModuleData.labelValueRows`, duas colunas por linha.
 *
 * A Google Wallet renderiza mal linhas com uma coluna só, então um campo
 * sobrando no fim ocupa a linha inteira em vez de ficar meia-vazia.
 */
function paraLabelValueRows(campos) {
  const linhas = [];
  for (let i = 0; i < campos.length; i += 2) {
    const par = campos.slice(i, i + 2);
    linhas.push({
      columns: par.map((c) => ({ label: c.rotulo, value: c.valor })),
    });
  }
  return linhas;
}

module.exports = {
  ORDEM_CAMPOS,
  CAMPOS_PADRAO,
  resolverCampos,
  montarCamposDoPasse,
  paraTextModules,
  paraLabelValueRows,
};
