import React, { useState } from 'react';
import { MimoMobileApp, MobileScreenId } from './MimoMobileApp.js';
import { DesktopOverview } from '../pages/desktop/DesktopOverview.js';
import { DesktopCustomers } from '../pages/desktop/DesktopCustomers.js';
import { DesktopTeam } from '../pages/desktop/DesktopTeam.js';
import { DesktopCardStudio } from '../pages/desktop/DesktopCardStudio.js';
import { DesktopReports } from '../pages/desktop/DesktopReports.js';
import { Smartphone, Monitor, Eye } from 'lucide-react';

export const MimoGalleryView: React.FC = () => {
  const [activeDesktopTab, setActiveDesktopTab] = useState<'visao-geral' | 'clientes' | 'equipe' | 'criador' | 'relatorios'>('visao-geral');

  const mobileScreens: Array<{ id: MobileScreenId; title: string }> = [
    { id: 'login', title: '1. Login Mobile' },
    { id: 'home', title: '2. Balcão Home' },
    { id: 'convite', title: '3. Convite QR' },
    { id: 'scanner', title: '4. Scanner Câmera' },
    { id: 'selo-sucesso', title: '5. Selo Registrado (9/10)' },
    { id: 'recompensa', title: '6. Recompensa (10/10)' },
    { id: 'cadastro', title: '7. Cadastro Consumidor' },
    { id: 'wallet-pass', title: '8. Adicionar à Wallet' },
  ];

  return (
    <div className="space-y-12 py-6 px-4 max-w-full mx-auto animate-fade-in text-white">
      {/* Section 1: The 8 Mobile Screens (Matching Left Side of Figma) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-white/8 pb-3">
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-[#FFC82C]" />
            <h2 className="text-xl font-black text-white">
              App Mobile & Balcão (8 Telas do Fluxo)
            </h2>
          </div>
          <span className="text-xs text-white/50">
            Fluxo completo do caixa e do cliente no celular
          </span>
        </div>

        {/* Horizontal scrollable or multi-column grid of the 8 phones */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-6 items-start">
          {mobileScreens.map((screen) => (
            <div key={screen.id} className="flex flex-col items-center space-y-2">
              <span className="text-xs font-bold text-[#FFC82C] bg-[#FFC82C]/10 border border-[#FFC82C]/20 px-3 py-1 rounded-full">
                {screen.title}
              </span>
              <div className="scale-[0.9] origin-top">
                <MimoMobileApp initialScreen={screen.id} standalone={true} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 2: The 5 Desktop Screens (Matching Right Side of Figma) */}
      <div className="space-y-6 pt-8 border-t border-white/10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/8 pb-3">
          <div className="flex items-center gap-2">
            <Monitor className="w-5 h-5 text-[#FFC82C]" />
            <h2 className="text-xl font-black text-white">
              Mimo — Painel de Lojista (5 Desktop Screens)
            </h2>
          </div>

          {/* Desktop Screen Switcher */}
          <div className="flex items-center gap-1.5 overflow-x-auto bg-[#16161A] p-1.5 rounded-xl border border-white/8">
            {[
              { id: 'visao-geral', label: '1. Visão Geral' },
              { id: 'clientes', label: '2. Clientes' },
              { id: 'equipe', label: '3. Minha Equipe' },
              { id: 'criador', label: '4. Criador de Cartão' },
              { id: 'relatorios', label: '5. Relatórios' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveDesktopTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                  activeDesktopTab === tab.id
                    ? 'bg-[#FFC82C] text-black shadow-sm'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Selected Desktop Screen Container */}
        <div className="bg-[#121215] border border-white/8 rounded-3xl p-6 shadow-2xl">
          {activeDesktopTab === 'visao-geral' && <DesktopOverview />}
          {activeDesktopTab === 'clientes' && <DesktopCustomers />}
          {activeDesktopTab === 'equipe' && <DesktopTeam />}
          {activeDesktopTab === 'criador' && <DesktopCardStudio />}
          {activeDesktopTab === 'relatorios' && <DesktopReports />}
        </div>
      </div>
    </div>
  );
};
