import { CardDesign, CardHolderData, InfoFieldsConfig, ORDEM_CAMPOS } from './types.js';

/**
 * Montagem dos campos exibidos no passe, a partir do que o lojista configurou.
 *
 * Existe para que a prévia do estúdio e o passe real saiam idênticos. Antes
 * cada lado montava a sua lista: a prévia lia `design.fields`, enquanto a Cloud
 * Function escrevia rótulos fixos no código ("CLIENTE VIP", "STATUS", "PRÊMIO").
 * O lojista configurava uma coisa e o cliente recebia outra.
 *
 * A contraparte no servidor é `functions/pass-fields.js`, que implementa esta
 * mesma ordem e os mesmos valores. **Alterar um exige alterar o outro.**
 */
export interface CampoDoPasse {
  chave: keyof InfoFieldsConfig;
  rotulo: string;
  valor: string;
}

export function montarCamposDoPasse(
  design: CardDesign,
  holder: CardHolderData
): CampoDoPasse[] {
  const { stamps, reward, fields, brand } = design;
  const faltam = Math.max(0, stamps.total - holder.selos);
  const completo = faltam === 0;

  const valorPorCampo: Record<keyof InfoFieldsConfig, () => string> = {
    cliente: () => holder.nome,
    recompensa: () => reward.label,
    faltam: () =>
      completo
        ? 'Cartela completa'
        : `${faltam} ${faltam === 1 ? 'selo' : 'selos'}`,
    ciclo: () => `${holder.ciclo || 1}º cartão`,
    unidade: () => holder.unidade || fields.unidade.value || 'Matriz',
    programa: () => brand.tagline,
    status: () => holder.status || (completo ? 'Completo' : 'Ativo'),
    validade: () => `${reward.validityDays} dias após completar`,
  };

  return ORDEM_CAMPOS.filter((chave) => fields[chave]?.enabled).map((chave) => ({
    chave,
    // O rótulo é sempre o que o lojista digitou — nunca um texto fixo.
    rotulo: fields[chave].label,
    valor: valorPorCampo[chave](),
  }));
}
