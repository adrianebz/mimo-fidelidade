import React from 'react';
import { Lock } from 'lucide-react';
import { NOME_PLANO, planoMinimo, Recurso } from '../planos.js';

interface Props {
  recurso: Recurso;
  titulo: string;
  /** O que o lojista ganha ao liberar — é o que vende o upgrade. */
  descricao: string;
  compacto?: boolean;
  className?: string;
}

/**
 * Recurso fora do plano: aparece com cadeado em vez de sumir. O lojista vê o
 * que está perdendo e qual plano libera — é o que vende o upgrade.
 */
export const RecursoBloqueado: React.FC<Props> = ({ recurso, titulo, descricao, compacto, className = '' }) => {
  const plano = NOME_PLANO[planoMinimo(recurso)];
  if (compacto) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full border border-border/60 bg-secondary/60 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground ${className}`}
        title={`${titulo} — disponível no plano ${plano}`}
      >
        <Lock className="h-3 w-3" />
        Plano {plano}
      </span>
    );
  }
  return (
    <div className={`rounded-2xl border border-dashed border-border bg-card/50 p-4 flex items-start gap-3 ${className}`}>
      <div className="h-9 w-9 shrink-0 rounded-xl bg-secondary flex items-center justify-center text-muted-foreground">
        <Lock className="h-4 w-4" />
      </div>
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-semibold text-foreground">
          {titulo} <span className="text-xs font-bold text-primary">· Plano {plano}</span>
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed">{descricao}</p>
        <p className="text-[11px] text-muted-foreground pt-1">Para mudar de plano, fale com a equipe Boomii.</p>
      </div>
    </div>
  );
};

export default RecursoBloqueado;
