import React from 'react';
import { MimoLogo } from './MimoLogo.js';
import { 
  LayoutDashboard, Users, UserCheck, Palette, 
  BarChart3, Store, CheckCircle2, ChevronDown, Bell, LogOut,
  Smartphone, Monitor, Grid
} from 'lucide-react';

export type DesktopScreenTab = 'visao-geral' | 'clientes' | 'equipe' | 'criador' | 'relatorios';

interface MimoDesktopShellProps {
  currentTab: DesktopScreenTab;
  onNavigate: (tab: DesktopScreenTab) => void;
  orgName?: string;
  userEmail?: string;
  onLogout?: () => void;
  viewMode: 'desktop' | 'mobile-flow' | 'gallery';
  onToggleViewMode: (mode: 'desktop' | 'mobile-flow' | 'gallery') => void;
  children: React.ReactNode;
}

export const MimoDesktopShell: React.FC<MimoDesktopShellProps> = ({
  currentTab,
  onNavigate,
  orgName = 'Padaria Central',
  userEmail = 'lojista@padariacentral.com',
  onLogout,
  viewMode,
  onToggleViewMode,
  children
}) => {
  const menuItems: Array<{ id: DesktopScreenTab; label: string; icon: React.ReactNode }> = [
    { id: 'visao-geral', label: 'Visão Geral', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'clientes', label: 'Clientes', icon: <Users className="w-4 h-4" /> },
    { id: 'equipe', label: 'Minha Equipe', icon: <UserCheck className="w-4 h-4" /> },
    { id: 'criador', label: 'Criador de Cartão', icon: <Palette className="w-4 h-4" /> },
    { id: 'relatorios', label: 'Relatórios', icon: <BarChart3 className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-[#0F0F10] text-white flex flex-col font-sans antialiased selection:bg-[#FFC82C] selection:text-black">
      {/* Top Experience Switcher Banner */}
      <div className="h-11 bg-[#141418] border-b border-white/8 px-4 sm:px-6 flex items-center justify-between text-xs sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#FFC82C] animate-pulse"></span>
          <span className="font-bold text-white/90">Mimo Fidelidade Digital</span>
          <span className="text-white/40 hidden sm:inline">•</span>
          <span className="text-white/50 text-[11px] hidden sm:inline">Modelo Oficial do App (Desktop & Mobile)</span>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-1 bg-black/60 p-1 rounded-xl border border-white/10">
          <button
            type="button"
            onClick={() => onToggleViewMode('desktop')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
              viewMode === 'desktop'
                ? 'bg-[#FFC82C] text-black shadow-sm'
                : 'text-white/70 hover:text-white'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Painel Desktop</span>
          </button>

          <button
            type="button"
            onClick={() => onToggleViewMode('mobile-flow')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
              viewMode === 'mobile-flow'
                ? 'bg-[#FFC82C] text-black shadow-sm'
                : 'text-white/70 hover:text-white'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>App Mobile (8 Telas)</span>
          </button>

          <button
            type="button"
            onClick={() => onToggleViewMode('gallery')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
              viewMode === 'gallery'
                ? 'bg-[#FFC82C] text-black shadow-sm'
                : 'text-white/70 hover:text-white'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>Ver Todas Juntas</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex min-w-0">
        {/* Left Sidebar (Matching Figma Screenshot exactly) */}
        <aside className="hidden lg:flex w-60 bg-[#16161A] border-r border-white/8 flex-col shrink-0">
          {/* Logo Header */}
          <div className="h-20 border-b border-white/8 flex items-center px-6">
            <MimoLogo size="md" showSubtitle={true} />
          </div>

          {/* Navigation Links */}
          <div className="flex-1 px-3.5 py-6 space-y-1.5">
            {menuItems.map((item) => {
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                >
                  <span className={isActive ? 'text-black' : 'text-white/60'}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Store Info Footer */}
          <div className="p-4 border-t border-white/8 bg-black/20 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#FFC82C]/15 border border-[#FFC82C]/30 text-[#FFC82C] flex items-center justify-center font-black text-sm">
                P
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white truncate">{orgName}</p>
                <div className="flex items-center gap-1 text-[11px] text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  <span>Online no Caixa</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onLogout}
              className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-white/50 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair da conta</span>
            </button>
          </div>
        </aside>

        {/* Main Content Body */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#0F0F10]">
          {/* Top Bar */}
          <header className="h-16 bg-[#16161A]/80 backdrop-blur-md border-b border-white/8 px-6 flex items-center justify-between sticky top-11 z-30">
            <div className="flex items-center gap-3">
              {/* Mobile menu button for small screens */}
              <div className="lg:hidden flex items-center gap-2 overflow-x-auto py-1">
                {menuItems.map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onNavigate(m.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                      currentTab === m.id ? 'bg-[#FFC82C] text-black' : 'text-white/60 hover:text-white'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <div className="hidden lg:flex items-center gap-2">
                <span className="text-sm font-bold text-white">
                  {menuItems.find(m => m.id === currentTab)?.label}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Active Status Badge */}
              <div className="hidden sm:flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full text-xs font-semibold text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Ativo ({orgName})</span>
              </div>

              {/* User Avatar */}
              <div className="flex items-center gap-2.5 pl-2">
                <div className="w-8 h-8 rounded-full bg-[#FFC82C] text-black flex items-center justify-center font-bold text-xs shadow-md">
                  PC
                </div>
                <span className="text-xs font-semibold text-white/80 hidden sm:inline">
                  {userEmail.split('@')[0]}
                </span>
              </div>
            </div>
          </header>

          {/* Render Active Screen Content */}
          <main className="flex-1 p-5 sm:p-7 max-w-7xl w-full mx-auto space-y-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
};
