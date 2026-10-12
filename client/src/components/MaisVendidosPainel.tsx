import React, { useEffect, useState } from 'react';
import { RefreshCw, TrendingUp } from 'lucide-react';
import { listarItens, ListaItens, Unidade } from '../services/boomiiWalletService.js';

interface Props {
  lojaId: string;
  /** Unidades ativas (filiais) para o filtro; vazio/1 = sem filtro. */
  unidades: Unidade[];
}

function mesesRecentes(qtd = 6): Array<{ id: string; rotulo: string }> {
  const agora = new Date();
  return Array.from({ length: qtd }, (_, i) => {
    const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
    const id = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const rotulo = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return { id, rotulo: i === 0 ? `Este mês (${rotulo})` : rotulo };
  });
}

/**
 * Ranking real de produtos (Itens Fixos, plano Completo): vem dos itens
 * marcados em cada carimbo, contados por mês e por unidade no servidor.
 */
export const MaisVendidosPainel: React.FC<Props> = ({ lojaId, unidades }) => {
  const meses = mesesRecentes();
  const [mes, setMes] = useState(meses[0].id);
  const [unidade, setUnidade] = useState<string>('todas');
  const [dados, setDados] = useState<ListaItens | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    listarItens(lojaId, mes).then((res) => {
      if (!ativo) return;
      setCarregando(false);
      if (res.sucesso) {
        setDados(res);
        setErro(null);
      } else setErro(res.erro);
    });
    return () => {
      ativo = false;
    };
  }, [lojaId, mes]);

  const qtdDe = (vendasMes: number, porUnidade: Record<string, number>) =>
    unidade === 'todas' ? vendasMes : Number(porUnidade[unidade]) || 0;

  const ranking = (dados?.itens || [])
    .map((i) => ({ ...i, qtd: qtdDe(i.vendasMes, i.vendasMesPorUnidade) }))
    .filter((i) => i.qtd > 0)
    .sort((a, b) => b.qtd - a.qtd);
  const totalItens = ranking.reduce((s, i) => s + i.qtd, 0);
  const faturamento = ranking.reduce((s, i) => s + (i.preco ? i.preco * i.qtd : 0), 0);
  const maior = ranking[0]?.qtd || 1;

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <span className="label-eyebrow text-primary">Análise</span>
        <h1 className="text-3xl font-black text-foreground tracking-tight mt-1">Mais Vendidos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Produtos marcados no balcão, a cada compra, no modo Itens Fixos.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          value={mes}
          onChange={(e) => setMes(e.target.value)}
          className="rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary cursor-pointer"
          aria-label="Mês"
        >
          {meses.map((m) => (
            <option key={m.id} value={m.id}>
              {m.rotulo}
            </option>
          ))}
        </select>
        {unidades.length > 1 && (
          <select
            value={unidade}
            onChange={(e) => setUnidade(e.target.value)}
            className="rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary cursor-pointer"
            aria-label="Unidade"
          >
            <option value="todas">Todas as unidades</option>
            {unidades.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </select>
        )}
      </div>

      {dados?.modalidade === 'geral' && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-500">
          A loja está em Vendas Gerais: os carimbos não registram produtos. Ative os Itens Fixos em Itens Participantes
          para o ranking começar a contar.
        </p>
      )}

      {erro && <p className="text-sm text-rose-500">{erro}</p>}

      {carregando ? (
        <div className="py-12 flex justify-center">
          <RefreshCw className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : ranking.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center space-y-2">
          <TrendingUp className="w-7 h-7 text-muted-foreground mx-auto" />
          <p className="text-sm font-semibold text-foreground">Nenhuma venda registrada neste período</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="surface-panel rounded-2xl p-4">
              <span className="text-xs text-muted-foreground">Itens vendidos</span>
              <div className="text-2xl font-black text-foreground tabular-nums">{totalItens}</div>
            </div>
            <div className="surface-panel rounded-2xl p-4">
              <span className="text-xs text-muted-foreground">Faturamento estimado</span>
              <div className="text-2xl font-black text-foreground tabular-nums">
                {faturamento > 0 ? faturamento.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}
              </div>
              <span className="text-[10px] text-muted-foreground">pelo preço cadastrado de cada item</span>
            </div>
          </div>

          <ol className="surface-panel rounded-2xl p-4 sm:p-5 space-y-3">
            {ranking.map((i, pos) => (
              <li key={i.id} className="space-y-1">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate">
                    <span className="font-black text-primary tabular-nums mr-2">{pos + 1}º</span>
                    <span className="font-semibold text-foreground">{i.nome}</span>
                    <span className="text-xs text-muted-foreground ml-1.5">{i.categoria}</span>
                  </span>
                  <span className="shrink-0 text-muted-foreground tabular-nums">
                    <strong className="text-foreground">{i.qtd}</strong> · {Math.round((i.qtd / totalItens) * 100)}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${(i.qtd / maior) * 100}%` }} />
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
};

export default MaisVendidosPainel;
