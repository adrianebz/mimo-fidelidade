import React, { useState } from 'react';

export type SiteNavTab = 'inicio' | 'como-funciona' | 'precos' | 'contato' | 'login' | 'painel';

interface SiteHeaderProps {
  currentTab: SiteNavTab;
  onNavigate: (tab: SiteNavTab) => void;
}

export function MimoWordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`font-display text-2xl font-bold tracking-tight ${className}`}>
      mim<span className="text-primary">o</span>
    </span>
  );
}

const navItems: Array<{ id: SiteNavTab; label: string }> = [
  { id: 'inicio', label: 'Início' },
  { id: 'como-funciona', label: 'Como funciona' },
  { id: 'precos', label: 'Preços' },
  { id: 'contato', label: 'Contato' },
];

export const SiteHeader: React.FC<SiteHeaderProps> = ({ currentTab, onNavigate }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        {/* Logo */}
        <button
          type="button"
          onClick={() => onNavigate('inicio')}
          className="flex items-baseline gap-2 cursor-pointer focus:outline-none bg-transparent border-0 p-0 text-left"
        >
          <MimoWordmark />
          <span className="hidden text-[10px] tracking-[0.28em] text-muted-foreground sm:inline">
            FIDELIDADE DIGITAL
          </span>
        </button>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-7 md:flex">
          {navItems.map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`text-sm transition-colors cursor-pointer bg-transparent border-0 p-0 ${
                  isActive
                    ? 'text-foreground font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* CTA Button & Login link */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => onNavigate('login')}
            className="hidden sm:inline-flex text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer bg-transparent border-0 p-0"
          >
            Área do Lojista
          </button>

          <button
            type="button"
            onClick={() => onNavigate('contato')}
            className="btn-mimo px-5 py-2.5 text-sm cursor-pointer"
          >
            Falar com a Mimo
          </button>

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-muted-foreground hover:text-foreground cursor-pointer bg-transparent border-0"
            aria-label="Menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-border/60 bg-background px-5 py-4 space-y-3">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onNavigate(item.id);
                setMobileMenuOpen(false);
              }}
              className={`block w-full text-left py-2 text-sm cursor-pointer bg-transparent border-0 ${
                currentTab === item.id
                  ? 'text-foreground font-semibold'
                  : 'text-muted-foreground'
              }`}
            >
              {item.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              onNavigate('login');
              setMobileMenuOpen(false);
            }}
            className="block w-full text-left py-2 text-sm font-semibold text-primary cursor-pointer bg-transparent border-0"
          >
            Área do Lojista →
          </button>
        </div>
      )}
    </header>
  );
};
