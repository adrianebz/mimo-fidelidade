import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, Users, Globe, CreditCard, PlusCircle, 
  Megaphone, Star, Cake, ClipboardCheck, QrCode, ShieldCheck, 
  LogOut, Menu, X, ChevronDown, Bell, CheckCircle2, MessageCircle,
  ExternalLink, Sparkles, AlertCircle
} from 'lucide-react';

export type DashboardNavTab = 
  | 'painel' 
  | 'clientes' 
  | 'pagina' 
  | 'cartoes' 
  | 'novo-cartao' 
  | 'campanhas' 
  | 'avaliacoes' 
  | 'aniversarios' 
  | 'pesquisas'
  | 'balcao'
  | 'plataforma';

interface DashboardLayoutProps {
  currentTab: DashboardNavTab;
  onNavigate: (tab: DashboardNavTab) => void;
  orgName?: string;
  userEmail?: string;
  onLogout?: () => void;
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  currentTab,
  onNavigate,
  orgName = 'NOX dessert club',
  userEmail = 'leonam.ataide@gmail.com',
  onLogout,
  children
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showBannerNotice, setShowBannerNotice] = useState(true);
  const [showChatModal, setShowChatModal] = useState(false);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [currentTab]);

  const navMenuItems = [
    {
      group: 'MENU',
      items: [
        { id: 'painel' as DashboardNavTab, label: 'Painel', icon: <LayoutDashboard className="w-4 h-4" /> },
        { id: 'clientes' as DashboardNavTab, label: 'Clientes', icon: <Users className="w-4 h-4" /> },
        { id: 'pagina' as DashboardNavTab, label: 'Sua página', icon: <Globe className="w-4 h-4" /> },
      ]
    },
    {
      group: 'CARTÕES',
      items: [
        { id: 'cartoes' as DashboardNavTab, label: 'Gerenciar cartões', icon: <CreditCard className="w-4 h-4" /> },
        { id: 'novo-cartao' as DashboardNavTab, label: 'Criar novo cartão', icon: <PlusCircle className="w-4 h-4" /> },
      ]
    },
    {
      group: 'ENGAJE',
      items: [
        { id: 'campanhas' as DashboardNavTab, label: 'Campanhas', icon: <Megaphone className="w-4 h-4" /> },
        { id: 'avaliacoes' as DashboardNavTab, label: 'Avaliações Google', icon: <Star className="w-4 h-4" /> },
        { id: 'aniversarios' as DashboardNavTab, label: 'Aniversários', icon: <Cake className="w-4 h-4" /> },
        { id: 'pesquisas' as DashboardNavTab, label: 'Pesquisas', icon: <ClipboardCheck className="w-4 h-4" />, badge: '1' },
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex text-slate-800 font-sans antialiased">
      {/* ── DESKTOP SIDEBAR ── */}
      <aside className="hidden lg:flex w-64 bg-white border-r border-slate-200 flex-col shrink-0 fixed inset-y-0 left-0 z-30">
        {/* Brand Header */}
        <div className="h-16 border-b border-slate-100 flex items-center px-5 gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-600 flex items-center justify-center text-white shadow-sm shrink-0">
            <span className="font-black text-xs tracking-tight">Fave<br />Card</span>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold text-slate-900 truncate leading-tight">
              {orgName}
            </h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span className="text-[11px] font-medium text-slate-500">Plano Pro Ativo</span>
            </div>
          </div>
        </div>

        {/* Navigation Sections */}
        <div className="flex-1 overflow-y-auto px-3.5 py-4 space-y-6">
          {navMenuItems.map((group) => (
            <div key={group.group} className="space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-1 block">
                {group.group}
              </span>
              {group.items.map((item) => {
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onNavigate(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      isActive 
                        ? 'bg-blue-50 text-blue-700 shadow-xs' 
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={isActive ? 'text-blue-600' : 'text-slate-400'}>
                        {item.icon}
                      </span>
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}

          {/* Quick Tools Section */}
          <div className="pt-2 border-t border-slate-100 space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-1 block">
              OPERACIONAL
            </span>
            <button
              type="button"
              onClick={() => onNavigate('balcao')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                currentTab === 'balcao'
                  ? 'bg-teal-50 text-teal-700'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <QrCode className="w-4 h-4 text-teal-600" />
              <span>Balcão / Caixa PWA</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('plataforma')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                currentTab === 'plataforma'
                  ? 'bg-slate-100 text-slate-900'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-slate-400" />
              <span>Admin da Plataforma</span>
            </button>
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="p-3.5 border-t border-slate-100 bg-slate-50/50">
          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sair da conta</span>
          </button>
        </div>
      </aside>

      {/* ── MOBILE DRAWER OVERLAY ── */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs lg:hidden animate-fade-in"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div 
            className="w-72 max-w-[85vw] bg-white h-full shadow-2xl flex flex-col animate-slide-in-left"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="h-16 border-b border-slate-100 flex items-center justify-between px-5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-teal-600 flex items-center justify-center text-white font-black text-xs">
                  FC
                </div>
                <div className="truncate">
                  <h3 className="text-sm font-bold text-slate-900 truncate">{orgName}</h3>
                  <span className="text-[10px] text-emerald-600 font-semibold">Plano Ativo</span>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Navigation */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
              {navMenuItems.map((group) => (
                <div key={group.group} className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 block">
                    {group.group}
                  </span>
                  {group.items.map((item) => {
                    const isActive = currentTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          onNavigate(item.id);
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold ${
                          isActive 
                            ? 'bg-blue-50 text-blue-700 font-bold' 
                            : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={isActive ? 'text-blue-600' : 'text-slate-400'}>
                            {item.icon}
                          </span>
                          <span>{item.label}</span>
                        </div>
                        {item.badge && (
                          <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}

              <div className="pt-2 border-t border-slate-100 space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    onNavigate('balcao');
                    setMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-teal-700 bg-teal-50"
                >
                  <QrCode className="w-4 h-4 text-teal-600" />
                  <span>Balcão / Caixa PWA</span>
                </button>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-slate-100">
              <button
                type="button"
                onClick={onLogout}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50"
              >
                <LogOut className="w-4 h-4" />
                <span>Sair da conta</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MAIN CONTENT WRAPPER ── */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-20 flex items-center justify-between px-4 sm:px-6">
          {/* Left: Mobile hamburger & breadcrumbs */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 focus:outline-none"
              aria-label="Abrir menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Live Indicator */}
            <div className="hidden sm:flex items-center gap-2 bg-emerald-50 border border-emerald-200/60 px-3 py-1 rounded-full text-xs font-medium text-emerald-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Apple & Google Wallet Conectadas</span>
            </div>
          </div>

          {/* Right: Actions, Language, Profile */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Novidades Badge */}
            <button
              type="button"
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-600"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
              <span>Novidades</span>
            </button>

            {/* Language Pill */}
            <div className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-full border border-slate-200 text-xs font-semibold text-slate-600">
              <span>🇧🇷</span>
              <span>PT</span>
            </div>

            {/* User Profile */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center gap-2.5 p-1 rounded-full hover:bg-slate-100 text-left transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
                  {userEmail.substring(0, 2).toUpperCase()}
                </div>
                <div className="hidden sm:block">
                  <div className="text-xs font-bold text-slate-800 leading-tight">
                    {userEmail.split('@')[0]}
                  </div>
                  <div className="text-[11px] text-slate-400 leading-none">
                    {userEmail}
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
              </button>

              {/* Profile Dropdown */}
              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-slate-100 py-1.5 z-40 animate-fade-in">
                  <div className="px-4 py-2 border-b border-slate-100">
                    <p className="text-xs font-bold text-slate-900">{orgName}</p>
                    <p className="text-[11px] text-slate-500 truncate">{userEmail}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileMenu(false);
                      onNavigate('balcao');
                    }}
                    className="w-full text-left px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <QrCode className="w-3.5 h-3.5 text-teal-600" />
                    Abrir Balcão / Caixa
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileMenu(false);
                      onNavigate('plataforma');
                    }}
                    className="w-full text-left px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                    Painel Plataforma
                  </button>
                  <div className="border-t border-slate-100 my-1"></div>
                  <button
                    type="button"
                    onClick={onLogout}
                    className="w-full text-left px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 flex items-center gap-2"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sair
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Body Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* Top Announcement Banner (Matching screenshot) */}
          {showBannerNotice && (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs relative">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-2 max-w-3xl">
                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-medium">
                    O seu programa de fidelização está ativo no plano Pro. Os clientes mantêm os seus cartões, carimbos e recompensas na Apple Wallet e Google Wallet.
                  </p>
                  <ul className="text-[11px] sm:text-xs text-slate-500 space-y-1 list-disc list-inside">
                    <li>Logotipo oficial e cores personalizadas sincronizados automaticamente nos cartões.</li>
                    <li>Campanhas push e ofertas de aniversário programadas para reter clientes ausentes.</li>
                    <li>Base de clientes 100% própria, segura e exportável a qualquer momento.</li>
                  </ul>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => alert('Plano Pro ativo com sucesso!')}
                    className="px-3.5 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors whitespace-nowrap"
                  >
                    Comparar funcionalidades dos planos
                  </button>

                  <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                    <span className="text-emerald-600 font-bold text-xs">★ Trustpilot</span>
                    <span className="text-[11px] font-bold text-slate-700">4.5/5</span>
                    <span className="text-[11px] text-teal-600 hover:underline cursor-pointer">
                      Ler avaliações →
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Page Content Rendered Here */}
          {children}
        </main>
      </div>

      {/* Floating Chat Button (Bottom Right, as in Screenshot) */}
      <button
        type="button"
        onClick={() => setShowChatModal(true)}
        className="floating-chat-btn"
        aria-label="Abrir suporte e ajuda"
      >
        <MessageCircle className="w-6 h-6" />
      </button>

      {/* Support Modal */}
      {showChatModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-teal-600 text-white flex items-center justify-center font-bold">
                  <MessageCircle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Suporte MIMO</h3>
                  <p className="text-[11px] text-emerald-600">Tempo de resposta médio: 2 min</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowChatModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Olá! Como podemos ajudar o <strong>{orgName}</strong> hoje? Selecione uma dúvida frequente ou inicie uma conversa com nosso time:
            </p>

            <div className="space-y-2">
              <button 
                type="button"
                onClick={() => alert('Como carimbar: Vá em "Sua Página" ou "Balcão / Caixa", digite o serial do cliente ou escaneie o QR da Wallet e clique em Carimbar Selo!')}
                className="w-full text-left p-2.5 rounded-xl border border-slate-200 hover:border-teal-500 hover:bg-teal-50/40 text-xs font-semibold text-slate-700 transition-colors"
              >
                Como carimbar o cartão no balcão da loja?
              </button>
              <button 
                type="button"
                onClick={() => alert('Para conectar sua conta da Apple ou Google, os certificados oficiais já estão vinculados à sua organização!')}
                className="w-full text-left p-2.5 rounded-xl border border-slate-200 hover:border-teal-500 hover:bg-teal-50/40 text-xs font-semibold text-slate-700 transition-colors"
              >
                Como funciona a integração com Apple e Google Wallet?
              </button>
              <button 
                type="button"
                onClick={() => alert('Para recuperar clientes ausentes, acesse Clientes > Ausentes > Recuperá-los para enviar uma notificação push!')}
                className="w-full text-left p-2.5 rounded-xl border border-slate-200 hover:border-teal-500 hover:bg-teal-50/40 text-xs font-semibold text-slate-700 transition-colors"
              >
                Como enviar push de lembrete para clientes ausentes?
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                alert('Mensagem enviada para o time de suporte! Responderemos por e-mail.');
                setShowChatModal(false);
              }}
              className="btn-primary-teal w-full text-xs font-bold py-2.5"
            >
              Falar com atendente humano
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
