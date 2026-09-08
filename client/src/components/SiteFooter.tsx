import React from 'react';
import { MimoWordmark, SiteNavTab } from './SiteHeader.js';

interface SiteFooterProps {
  onNavigate: (tab: SiteNavTab) => void;
}

const nav = [
  { id: 'inicio', label: 'Início' },
  { id: 'como-funciona', label: 'Como funciona' },
  { id: 'precos', label: 'Preços' },
  { id: 'contato', label: 'Contato' },
] as const;

export const SiteFooter: React.FC<SiteFooterProps> = ({ onNavigate }) => {
  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-12 md:flex-row md:items-start md:justify-between">
        <div className="max-w-xs">
          <MimoWordmark />
          <p className="mt-3 text-sm text-muted-foreground">
            Programa de fidelidade por selos direto na Apple Wallet e na Google Wallet. Sem
            aplicativo para o seu cliente baixar.
          </p>
        </div>

        <nav className="flex flex-col gap-3">
          <span className="label-eyebrow">Navegar</span>
          {nav.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className="text-left text-sm text-muted-foreground transition-colors hover:text-foreground cursor-pointer bg-transparent border-0 p-0"
            >
              {item.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onNavigate('login')}
            className="text-left text-sm font-semibold text-primary transition-colors hover:underline cursor-pointer bg-transparent border-0 p-0"
          >
            Área do Lojista (Login) →
          </button>
        </nav>

        <div className="flex flex-col gap-3">
          <span className="label-eyebrow">Contato</span>
          <a
            href="mailto:contato@mimo.com.br"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            contato@mimo.com.br
          </a>
          <span className="text-sm text-muted-foreground">São Paulo, Brasil</span>
        </div>
      </div>
      <div className="border-t border-border/60 px-5 py-5 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Mimo — Fidelidade Digital
      </div>
    </footer>
  );
};
