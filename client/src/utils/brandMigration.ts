/**
 * Migração das chaves locais da marca antiga para o prefixo `boomii_`.
 *
 * As chaves do localStorage guardam sessão do admin, lojista ativo e a config
 * do cartão publicada. Renomear o prefixo sem migrar deslogaria todo mundo e
 * faria o painel voltar ao estado inicial na primeira visita após o deploy.
 *
 * É idempotente e só copia quando a chave nova ainda não existe, então uma
 * aba antiga que grave no prefixo legado não sobrescreve dado novo.
 */

const PREFIXO_LEGADO = 'mimo_';
const PREFIXO_ATUAL = 'boomii_';

export function migrarChavesLocaisDaMarca(): void {
  if (typeof localStorage === 'undefined') return;

  try {
    const legadas = Object.keys(localStorage).filter((k) => k.startsWith(PREFIXO_LEGADO));
    if (legadas.length === 0) return;

    for (const chaveLegada of legadas) {
      const chaveNova = PREFIXO_ATUAL + chaveLegada.slice(PREFIXO_LEGADO.length);
      if (localStorage.getItem(chaveNova) === null) {
        const valor = localStorage.getItem(chaveLegada);
        if (valor !== null) localStorage.setItem(chaveNova, valor);
      }
      localStorage.removeItem(chaveLegada);
    }
  } catch {
    // Modo privado ou storage bloqueado: seguir sem migrar é preferível a
    // impedir o boot da aplicação.
  }
}
