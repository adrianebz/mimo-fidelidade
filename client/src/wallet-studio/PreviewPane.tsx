import React, { useState } from 'react';
import { Smartphone, Apple, Wallet } from 'lucide-react';
import type { CardDesign, CardHolderData, WalletTarget } from './types.js';
import { CardPreviewApple } from './CardPreviewApple.js';
import { CardPreviewGoogle } from './CardPreviewGoogle.js';

interface PreviewPaneProps {
  design: CardDesign;
  holder: CardHolderData;
  onHolderChange: (holder: CardHolderData) => void;
}

/**
 * Prévia em tempo real, com abas para as duas carteiras.
 *
 * Os controles de simulação (nome e nº de selos) alteram apenas os dados de
 * exemplo — nunca o design salvo —, para o lojista conferir como o cartão fica
 * em diferentes estágios do ciclo antes de publicar.
 */
export const PreviewPane: React.FC<PreviewPaneProps> = ({ design, holder, onHolderChange }) => {
  const [target, setTarget] = useState<WalletTarget>('google');

  return (
    <div className="space-y-4">
      {/* Abas */}
      <div className="flex items-center justify-between gap-3">
        <span className="label-eyebrow flex items-center gap-1.5">
          <Smartphone className="h-3.5 w-3.5" />
          Prévia em tempo real
        </span>
        <div className="flex rounded-full border border-border/60 bg-background/60 p-1">
          {([
            { id: 'apple' as const, label: 'Apple Wallet', icon: <Apple className="h-3.5 w-3.5" /> },
            { id: 'google' as const, label: 'Google Wallet', icon: <Wallet className="h-3.5 w-3.5" /> },
          ]).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTarget(tab.id)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold transition-colors ${
                target === tab.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Moldura do aparelho */}
      <div className="flex justify-center rounded-[34px] border border-border/60 bg-background/40 p-4">
        <div className="rounded-[30px] border-[6px] border-[#0A0A0C] bg-[#0A0A0C] p-2 shadow-2xl">
          {target === 'apple' ? (
            <CardPreviewApple design={design} holder={holder} />
          ) : (
            <CardPreviewGoogle design={design} holder={holder} />
          )}
        </div>
      </div>

      {/* Simulação */}
      <div className="surface-panel space-y-3 p-4">
        <span className="label-eyebrow">Simular cartão de um cliente</span>

        <input
          type="text"
          value={holder.nome}
          onChange={(e) => onHolderChange({ ...holder, nome: e.target.value })}
          placeholder="Nome do cliente"
          className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
        />

        <div>
          <div className="mb-1.5 flex items-center justify-between text-[11px]">
            <span className="font-semibold text-muted-foreground">Selos conquistados</span>
            <span className="rounded bg-primary/15 px-2 py-0.5 font-mono font-bold text-primary">
              {holder.selos} / {design.stamps.total}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={design.stamps.total}
            value={Math.min(holder.selos, design.stamps.total)}
            onChange={(e) => onHolderChange({ ...holder, selos: Number(e.target.value) })}
            className="w-full accent-primary cursor-pointer"
            aria-label="Selos conquistados"
          />
        </div>
      </div>
    </div>
  );
};

export default PreviewPane;
