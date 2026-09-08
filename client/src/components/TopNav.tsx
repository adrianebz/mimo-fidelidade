import React, { useState, useEffect, useRef } from 'react';
import { MimoLogo } from './MimoLogo.js';
import { 
  QrCode, Store, ShieldCheck, Sparkles, UserPlus, 
  Menu, X, LogOut, ChevronRight
} from 'lucide-react';

export type ActiveTab = 'showcase' | 'counter' | 'enroll' | 'dashboard' | 'platform' | 'login';

interface TopNavProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  orgName?: string;
  isLoggedIn?: boolean;
  onLogout?: () => void;
}

const navItems: Array<{ id: ActiveTab; label: string; icon: React.ReactNode; description: string }> = [
  { id: 'counter', label: 'Balcão PWA', icon: <QrCode className="w-4 h-4" />, description: 'Scanner e carimbo rápido' },
  { id: 'enroll', label: 'Cadastro', icon: <UserPlus className="w-4 h-4" />, description: 'Cadastro do cliente' },
  { id: 'dashboard', label: 'Painel', icon: <Store className="w-4 h-4" />, description: 'Gestão da loja' },
  { id: 'platform', label: 'Admin', icon: <ShieldCheck className="w-4 h-4" />, description: 'Governança multiempresa' },
  { id: 'showcase', label: 'Vitrine', icon: <Sparkles className="w-4 h-4" />, description: 'Apresentação da plataforma' },
];

export const TopNav: React.FC<TopNavProps> = ({
  activeTab,
  setActiveTab,
  orgName = 'Dessert Club',
  isLoggedIn = true,
  onLogout,
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close mobile nav on tab change
  useEffect(() => {
    setMobileOpen(false);
  }, [activeTab]);

  // Close on escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Prevent body scroll when mobile nav is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  if (!isLoggedIn) return null;

  return (
    <>
      <header className="sticky top-0 z-50 bg-[#0F0F10]/92 backdrop-blur-2xl border-b border-white/8 px-4 py-2.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Left: Logo + Store Indicator */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setActiveTab('showcase')}
              className="flex items-center text-left hover:opacity-90 transition-opacity shrink-0"
              aria-label="Página inicial"
            >
              <MimoLogo size="sm" showSubtitle={false} />
            </button>

            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/8 text-xs">
              <span className="w-2 h-2 rounded-full bg-mimo-green animate-pulse shrink-0"></span>
              <span className="text-white/50 shrink-0">Loja:</span>
              <span className="font-semibold text-white truncate max-w-[140px]">{orgName}</span>
            </div>
          </div>

          {/* Center: Desktop Navigation Tabs */}
          <nav className="hidden lg:flex items-center gap-1 p-1 bg-white/5 border border-white/8 rounded-2xl">
            {navItems.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
                  activeTab === item.id
                    ? item.id === 'showcase'
                      ? 'bg-white/15 text-white font-bold shadow-sm'
                      : 'bg-mimo-yellow text-black shadow-md font-bold'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            {/* Logout button (desktop) */}
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="hidden lg:flex items-center gap-1.5 text-xs text-white/50 hover:text-white/80 transition-colors px-2 py-1.5"
                title="Sair"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Mobile hamburger */}
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden flex items-center justify-center w-10 h-10 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 transition-all"
              aria-label="Abrir menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* ═══ Mobile Side Panel ═══ */}
      {mobileOpen && (
        <>
          {/* Overlay */}
          <div
            className="mobile-nav-overlay"
            onClick={() => setMobileOpen(false)}
          />

          {/* Panel */}
          <div className="mobile-nav-panel" ref={panelRef}>
            {/* Panel Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <MimoLogo size="sm" showSubtitle={false} />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-all"
                aria-label="Fechar menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Store Indicator (mobile) */}
            <div className="px-4 py-3 border-b border-white/5">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/8 text-xs">
                <span className="w-2 h-2 rounded-full bg-mimo-green animate-pulse shrink-0"></span>
                <span className="text-white/50">Loja Ativa:</span>
                <span className="font-bold text-white">{orgName}</span>
              </div>
            </div>

            {/* Navigation Items */}
            <nav className="flex-1 py-2 px-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-white/30 px-3 py-2">
                Navegação
              </div>
              {navItems.map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all duration-200 mb-0.5 ${
                    activeTab === item.id
                      ? 'bg-mimo-yellow/15 border border-mimo-yellow/30 text-mimo-yellow'
                      : 'text-white/70 hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    activeTab === item.id
                      ? 'bg-mimo-yellow/20 text-mimo-yellow'
                      : 'bg-white/5 text-white/50'
                  }`}>
                    {item.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold">{item.label}</div>
                    <div className="text-[10px] text-white/40 mt-0.5">{item.description}</div>
                  </div>
                  <ChevronRight className={`w-4 h-4 shrink-0 ${
                    activeTab === item.id ? 'text-mimo-yellow/60' : 'text-white/20'
                  }`} />
                </button>
              ))}
            </nav>

            {/* Logout (mobile) */}
            {onLogout && (
              <div className="p-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={onLogout}
                  className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-white/60 hover:text-white py-3 px-4 rounded-xl bg-white/5 border border-white/8 hover:bg-white/10 transition-all"
                >
                  <LogOut className="w-4 h-4" />
                  Sair da Conta
                </button>
              </div>
            )}

            {/* Footer */}
            <div className="px-4 pb-4 pt-1">
              <div className="text-[10px] text-white/30 text-center">
                MIMO v2.0 — Fidelidade Digital
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
};
