import React, { useState } from 'react';
import { 
  Plus, Lock, Sparkles, ChevronRight, ChevronDown, 
  ExternalLink, Palette, Smartphone, Apple, QrCode,
  CheckCircle2, AlertCircle, RefreshCw, Eye
} from 'lucide-react';
import { PassPreview } from '../components/PassPreview.js';
import * as mock from '../services/mockData.js';

interface ManageCardsProps {
  onNavigateToDesigner: () => void;
  onNavigateToCounter: () => void;
}

export const ManageCards: React.FC<ManageCardsProps> = ({
  onNavigateToDesigner,
  onNavigateToCounter
}) => {
  const [showDeactivated, setShowDeactivated] = useState(false);
  const [activeTabWallet, setActiveTabWallet] = useState<'apple' | 'google'>('apple');

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Breadcrumb and Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium mb-1">
            <span>Início</span>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-slate-700 font-semibold">Gerenciar cartões</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Gerenciar cartões
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onNavigateToDesigner}
            className="btn-primary-teal text-xs font-bold py-2.5 px-4"
          >
            <Palette className="w-4 h-4" />
            <span>Editar Design do Cartão</span>
          </button>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 items-start">
        {/* Card 1: Novo Cartão (Dashed Card with PRO badge, exactly as in screenshot) */}
        <div 
          onClick={onNavigateToDesigner}
          className="saas-card-dashed min-h-[420px] p-6 flex flex-col items-center justify-center text-center relative cursor-pointer group hover:shadow-md transition-all"
        >
          <div className="absolute top-4 right-4 bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-blue-600" />
            <span>PRO</span>
          </div>

          <div className="w-14 h-14 rounded-full bg-slate-100 group-hover:bg-teal-50 border border-slate-200 group-hover:border-teal-300 flex items-center justify-center text-slate-400 group-hover:text-teal-600 mb-4 transition-colors">
            <Lock className="w-6 h-6" />
          </div>

          <h3 className="text-base font-bold text-slate-800 mb-1 group-hover:text-teal-700 transition-colors">
            Novo cartão
          </h3>
          <p className="text-xs text-slate-500 max-w-[200px]">
            Toque para adicionar outro cartão de fidelidade ou campanha específica
          </p>

          <span className="mt-4 text-xs font-bold text-teal-600 group-hover:underline flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" />
            Criar novo modelo
          </span>
        </div>

        {/* Card 2: Active Card (Dessert Club, exactly as in screenshot) */}
        <div className="saas-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 leading-tight">
                  Dessert Club
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-slate-500">Estado:</span>
                  <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200/60 px-2 py-0.5 rounded-full text-xs font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    Ativo
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg">
                <button
                  type="button"
                  onClick={() => setActiveTabWallet('apple')}
                  className={`p-1.5 rounded-md text-xs font-semibold ${
                    activeTabWallet === 'apple' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500'
                  }`}
                  title="Apple Wallet"
                >
                  <Apple className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTabWallet('google')}
                  className={`p-1.5 rounded-md text-xs font-semibold ${
                    activeTabWallet === 'google' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500'
                  }`}
                  title="Google Wallet"
                >
                  <Smartphone className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Embedded Realistic Wallet Pass Preview (Dark card with 1/10 stamps, gold coin, smile mascot) */}
            <div className="bg-[#0F0F10] rounded-2xl p-5 text-white shadow-lg relative overflow-hidden mb-5 border border-slate-800">
              {/* Card Header inside pass */}
              <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
                <div>
                  <span className="text-[10px] text-teal-400 font-bold tracking-widest uppercase block">
                    CARTÃO DE FIDELIDADE
                  </span>
                  <h4 className="text-sm font-black text-white">Dessert Club</h4>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-white/50 uppercase block font-mono">SALDO</span>
                  <span className="text-sm font-black text-amber-400 font-mono">1 / 10</span>
                </div>
              </div>

              {/* Grid of 10 stamps */}
              <div className="grid grid-cols-5 gap-2 my-3">
                {/* Stamp 1: Gold coin with Mimo smile stamped */}
                <div className="aspect-square rounded-full bg-amber-400 flex items-center justify-center shadow-md shadow-amber-400/30 border-2 border-amber-300">
                  <span className="text-sm">🪙</span>
                </div>

                {/* Stamps 2 to 9: Empty stamped circles */}
                {[2, 3, 4, 5, 6, 7, 8, 9].map((idx) => (
                  <div 
                    key={idx} 
                    className="aspect-square rounded-full bg-white/5 border border-dashed border-white/20 flex items-center justify-center text-[10px] font-mono text-white/30"
                  >
                    {idx}
                  </div>
                ))}

                {/* Stamp 10: Reward highlight */}
                <div className="aspect-square rounded-full bg-amber-400/20 border-2 border-dashed border-amber-400 flex items-center justify-center text-xs">
                  🎁
                </div>
              </div>

              {/* Reward text footer */}
              <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
                <div>
                  <span className="text-[9px] text-amber-400 font-bold uppercase tracking-wider block">
                    RECOMPENSA
                  </span>
                  <p className="text-xs font-bold text-white">
                    Colete selos e ganhe recompensas! (Cookie Grátis)
                  </p>
                </div>
                <div className="w-6 h-6 rounded-full bg-amber-400/20 flex items-center justify-center text-amber-400 text-xs font-bold">
                  ★
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onNavigateToDesigner}
                className="btn-outline-subtle text-xs py-2 w-full justify-center"
              >
                <Palette className="w-3.5 h-3.5" />
                <span>Editar design</span>
              </button>
              <button
                type="button"
                onClick={onNavigateToCounter}
                className="btn-outline-subtle text-xs py-2 w-full justify-center text-teal-700 border-teal-200 bg-teal-50/50 hover:bg-teal-50"
              >
                <QrCode className="w-3.5 h-3.5 text-teal-600" />
                <span>Balcão / QR</span>
              </button>
            </div>
            
            <div className="flex items-center justify-between text-[11px] text-slate-500 px-1 pt-1">
              <span>Atualizado há 2 horas</span>
              <span className="text-emerald-600 font-semibold">30 clientes ativos</span>
            </div>
          </div>
        </div>
      </div>

      {/* Collapsible Deactivated Cards Section (Matching screenshot) */}
      <div className="pt-4">
        <button
          type="button"
          onClick={() => setShowDeactivated(!showDeactivated)}
          className="flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors p-2 rounded-lg hover:bg-slate-100"
        >
          {showDeactivated ? (
            <ChevronDown className="w-4 h-4 text-slate-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-500" />
          )}
          <span>Mostrar cartões desativados (2)</span>
        </button>

        {showDeactivated && (
          <div className="mt-3 pl-6 grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-800">Cartão de Verão 2025</h4>
                <p className="text-[11px] text-slate-500">Campanha sazonal encerrada em 28/02/2026</p>
              </div>
              <span className="bg-slate-200 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                Desativado
              </span>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-800">Cartão VIP Gourmet</h4>
                <p className="text-[11px] text-slate-500">Cartão de 15 selos pausado para reformulação</p>
              </div>
              <span className="bg-slate-200 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                Desativado
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
