import React from 'react';
import { WalletBadges } from '../components/WalletBadges.js';
import { PassPreview } from '../components/PassPreview.js';
import { 
  Sparkles, Smartphone, ShieldCheck, Zap, 
  ArrowRight, QrCode, HeartHandshake, CheckCircle2,
  Users, Award, BarChart3
} from 'lucide-react';

interface LandingPageProps {
  onNavigate: (tab: any) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigate }) => {
  return (
    <div className="space-y-16 py-8 px-4 max-w-7xl mx-auto text-slate-800 antialiased animate-fade-in-up">
      {/* Hero Section */}
      <section className="text-center space-y-6 max-w-4xl mx-auto pt-6">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-50 border border-teal-200 text-xs font-bold text-teal-800 shadow-xs">
          <Sparkles className="w-3.5 h-3.5 text-teal-600" />
          <span>PROGRAMA DE FIDELIDADE POR SELOS NA CARTEIRA DIGITAL</span>
        </div>

        <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-slate-900 tracking-tight leading-tight">
          Fidelize seus clientes <br className="hidden sm:block" />
          <span className="text-teal-600">direto na carteira do celular</span>.
        </h1>

        <p className="text-sm sm:text-base md:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
          O cliente não baixa app, não cria login e não esquece o cartão de papel. O cartão vive nativamente na <strong>Apple Wallet</strong> e <strong>Google Wallet</strong>, com carimbo em 1 toque no caixa.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => onNavigate('painel')}
            className="btn-primary-teal w-full sm:w-auto text-sm py-3.5 px-7 shadow-md font-bold"
          >
            <span>Acessar Painel do Lojista</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => onNavigate('balcao')}
            className="btn-outline-subtle w-full sm:w-auto text-sm py-3.5 px-6 font-bold"
          >
            <QrCode className="w-4 h-4 text-teal-600" />
            <span>Simular Balcão / Caixa (≤ 2s)</span>
          </button>
        </div>

        {/* Official Wallet Badges */}
        <div className="pt-2">
          <WalletBadges />
        </div>
      </section>

      {/* Live Realistic Smartphone Mockup */}
      <section className="flex justify-center pt-2">
        <div className="relative">
          <PassPreview
            storeName="NOX Dessert Club"
            customerName="Maria Silva"
            stamps={8}
            rewardLabel="Cookie Grátis"
            serial="8f3a-92bc-41de-aa22"
          />
        </div>
      </section>

      {/* 4 Feature Pillars */}
      <section className="space-y-8 pt-6">
        <div className="text-center space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-teal-600">
            DIFERENCIAIS DO MIMO
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
            Muito superior ao cartão de papel tradicional
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="saas-card p-6 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
              <Smartphone className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Sem Download de Apps</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              O cliente escaneia o QR do balcão e salva o cartão em 30 segundos na Apple Wallet ou Google Wallet.
            </p>
          </div>

          <div className="saas-card p-6 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Carimbo em 1 Toque</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              O atendente carimba o selo em 5ms no tablet ou celular, com proteção antiduplicação de 3 minutos.
            </p>
          </div>

          <div className="saas-card p-6 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">CRM com Segmentos</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Identifique clientes habituais, novatos e ausentes, com disparo de notificação push para reativá-los.
            </p>
          </div>

          <div className="saas-card p-6 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Base Própria & LGPD</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Seus clientes pertencem à sua loja. Exporte a base completa em CSV a qualquer instante com 1 clique.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
