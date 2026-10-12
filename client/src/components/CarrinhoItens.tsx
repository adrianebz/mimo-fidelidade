import React, { useState } from 'react';
import { Minus, Plus, Search } from 'lucide-react';
import { ItemLoja } from '../services/boomiiWalletService.js';

interface Props {
  itens: ItemLoja[];
  /** id → quantidade marcada */
  carrinho: Record<string, number>;
  onChange: (carrinho: Record<string, number>) => void;
}

/** Selos que a compra marcada vai creditar (o servidor recalcula a partir do cadastro). */
export function selosDoCarrinho(itens: ItemLoja[], carrinho: Record<string, number>): number {
  return itens.reduce((s, i) => s + (carrinho[i.id] || 0) * i.selos, 0);
}

/**
 * Itens da compra, no leitor (modo Itens Fixos): marca-se tudo o que o
 * cliente levou e lê-se o QR UMA vez. Mais vendidos primeiro; busca para
 * cardápios grandes.
 */
export const CarrinhoItens: React.FC<Props> = ({ itens, carrinho, onChange }) => {
  const [busca, setBusca] = useState('');
  const termo = busca.trim().toLowerCase();
  const visiveis = termo
    ? itens.filter((i) => i.nome.toLowerCase().includes(termo) || i.categoria.toLowerCase().includes(termo))
    : itens;
  const totalItens = Object.values(carrinho).reduce((s, n) => s + n, 0);
  const selos = selosDoCarrinho(itens, carrinho);

  const mudar = (id: string, delta: number) => {
    const novo = { ...carrinho };
    const qtd = Math.max(0, Math.min(99, (novo[id] || 0) + delta));
    if (qtd === 0) delete novo[id];
    else novo[id] = qtd;
    onChange(novo);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-foreground">Itens desta compra</span>
        {totalItens > 0 && (
          <button type="button" onClick={() => onChange({})} className="text-[11px] text-muted-foreground hover:text-foreground cursor-pointer">
            Limpar
          </button>
        )}
      </div>

      {itens.length > 8 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar item"
            className="w-full rounded-xl border border-input bg-background pl-8 pr-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          />
        </div>
      )}

      <div className="max-h-56 overflow-y-auto rounded-xl border border-border/60 divide-y divide-border/40">
        {visiveis.map((i) => {
          const qtd = carrinho[i.id] || 0;
          return (
            <div key={i.id} className={`flex items-center gap-2 px-3 py-2 ${qtd ? 'bg-primary/5' : ''}`}>
              <div className="min-w-0 flex-1">
                <span className="text-sm font-medium text-foreground block truncate">{i.nome}</span>
                <span className="text-[10px] text-muted-foreground">
                  {i.selos === 0 ? 'não pontua' : `${i.selos} ${i.selos === 1 ? 'selo' : 'selos'}`}
                </span>
              </div>
              <button
                type="button"
                onClick={() => mudar(i.id, -1)}
                disabled={!qtd}
                aria-label={`Menos ${i.nome}`}
                className="h-8 w-8 rounded-lg border border-border flex items-center justify-center text-foreground disabled:opacity-30 cursor-pointer"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="w-6 text-center font-bold tabular-nums text-foreground">{qtd}</span>
              <button
                type="button"
                onClick={() => mudar(i.id, 1)}
                aria-label={`Mais ${i.nome}`}
                className="h-8 w-8 rounded-lg border border-primary/40 bg-primary/10 flex items-center justify-center text-primary cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          {totalItens} {totalItens === 1 ? 'item' : 'itens'}
        </span>
        <span className="font-bold text-primary">
          {selos} {selos === 1 ? 'selo' : 'selos'}
        </span>
      </div>
    </div>
  );
};

export default CarrinhoItens;
