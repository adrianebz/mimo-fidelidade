import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTema } from '../theme.js';

/**
 * Alternador de tema claro/escuro.
 *
 * É um botão único com dois estados visíveis (sol e lua) em vez de um ícone que
 * troca: mostrar as duas opções deixa claro que é uma escolha, e não um aviso
 * do tema atual — dúvida comum quando só aparece um ícone.
 */
export const ToggleTema: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { tema, alternarTema } = useTema();
  const escuro = tema === 'escuro';

  return (
    <button
      type="button"
      onClick={alternarTema}
      role="switch"
      aria-checked={escuro}
      aria-label={escuro ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
      title={escuro ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
      className={`relative inline-flex items-center gap-0.5 rounded-full border border-border bg-secondary/60 p-0.5 transition-colors cursor-pointer ${className}`}
    >
      <span
        className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
          !escuro ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground'
        }`}
      >
        <Sun className="h-3.5 w-3.5" />
      </span>
      <span
        className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
          escuro ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground'
        }`}
      >
        <Moon className="h-3.5 w-3.5" />
      </span>
    </button>
  );
};
