import React, { useState } from 'react';
import { 
  ChevronRight, Users, CreditCard, Sparkles, TrendingUp, 
  ArrowUpRight, QrCode, Palette, Megaphone, CheckCircle2,
  Calendar, Clock, Award, ShieldCheck
} from 'lucide-react';
import { demoCustomers } from '../services/mockData.js';

interface OverviewDashboardProps {
  onNavigate: (tab: any) => void;
}

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({ onNavigate }) => {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('7d');

  // Activity feed items
  const recentActivities = [
    { id: 1, customer: 'Maria Silva', action: 'Recebeu 1 selo no Balcão', time: 'Há 12 min', stamps: '8/10', type: 'stamp' },
    { id: 2, customer: 'João Santos', action: 'Adicionou cartão à Apple Wallet', time: 'Há 45 min', stamps: '3/10', type: 'wallet' },
    { id: 3, customer: 'Ana Costa', action: 'Completou 10 selos e resgatou Cookie Grátis!', time: 'Há 2 horas', stamps: '10/10', type: 'reward' },
    { id: 4, customer: 'Lucas Ferreira', action: 'Novo cadastro via QR Convite no balcão', time: 'Há 3 horas', stamps: '1/10', type: 'enroll' },
    { id: 5, customer: 'Camila Albuquerque', action: 'Recebeu 1 selo no Balcão', time: 'Ontem, 18:20', stamps: '6/10', type: 'stamp' },
  ];

  // 7-day volume
  const chartDays = [
    { day: 'Seg', stamps: 14, visits: 18 },
    { day: 'Ter', stamps: 19, visits: 22 },
    { day: 'Qua', stamps: 16, visits: 20 },
    { day: 'Qui', stamps: 24, visits: 29 },
    { day: 'Sex', stamps: 38, visits: 45 },
    { day: 'Sáb', stamps: 42, visits: 50 },
    { day: 'Dom', stamps: 31, visits: 36 },
  ];

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Breadcrumb & Welcome Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium mb-1">
            <span>Início</span>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-slate-700 font-semibold">Painel</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Visão Geral da Fidelidade
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-white border border-slate-200 p-1 rounded-xl flex items-center gap-1 text-xs font-semibold">
            {(['7d', '30d', '90d'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setTimeRange(r)}
                className={`px-3 py-1 rounded-lg transition-colors ${
                  timeRange === r 
                    ? 'bg-slate-900 text-white' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {r === '7d' ? 'Últimos 7 dias' : r === '30d' ? '30 dias' : 'Trimestre'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 4 Main KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Active Wallet Passes */}
        <div className="saas-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Clientes Ativos
            </span>
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">
            30
          </div>
          <div className="flex items-center gap-1 text-xs text-emerald-600 font-semibold mt-2">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>+6 novos clientes este mês</span>
          </div>
        </div>

        {/* KPI 2: Stamps Stamped */}
        <div className="saas-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Selos Carimbados
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">
            184
          </div>
          <div className="flex items-center gap-1 text-xs text-emerald-600 font-semibold mt-2">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>+18% em relação à semana passada</span>
          </div>
        </div>

        {/* KPI 3: Rewards Claimed */}
        <div className="saas-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Recompensas Entregues
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">
            12
          </div>
          <div className="flex items-center gap-1 text-xs text-slate-500 font-medium mt-2">
            <span>Ciclos de 10 selos concluídos</span>
          </div>
        </div>

        {/* KPI 4: Retention Rate */}
        <div className="saas-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Taxa de Retorno
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">
            84%
          </div>
          <div className="flex items-center gap-1 text-xs text-emerald-600 font-semibold mt-2">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Excelente fidelização contínua</span>
          </div>
        </div>
      </div>

      {/* Main Row: Activity Chart & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Weekly Stamps Chart */}
        <div className="lg:col-span-8 saas-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Frequência Semanal de Selos e Visitas
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Picos de visitação concentrados de quinta a domingo
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-semibold text-slate-600">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-teal-500"></span>
                <span>Selos</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-slate-200"></span>
                <span>Visitas</span>
              </div>
            </div>
          </div>

          {/* Bar Chart Visualization */}
          <div className="pt-6 pb-2">
            <div className="h-48 flex items-end justify-between gap-2 sm:gap-4 px-2 border-b border-slate-100">
              {chartDays.map((item) => {
                const maxVal = 50;
                const stampsHeight = (item.stamps / maxVal) * 100;
                const visitsHeight = (item.visits / maxVal) * 100;

                return (
                  <div key={item.day} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                    <div className="w-full flex items-end justify-center gap-1 sm:gap-1.5 h-full">
                      {/* Visits Bar */}
                      <div 
                        className="w-2.5 sm:w-4 bg-slate-200 rounded-t-sm group-hover:bg-slate-300 transition-all"
                        style={{ height: `${visitsHeight}%` }}
                        title={`${item.visits} visitas`}
                      />
                      {/* Stamps Bar */}
                      <div 
                        className="w-2.5 sm:w-4 bg-teal-500 rounded-t-sm group-hover:bg-teal-600 transition-all"
                        style={{ height: `${stampsHeight}%` }}
                        title={`${item.stamps} selos`}
                      />
                    </div>
                    <span className="text-[11px] font-bold text-slate-500 mt-1">
                      {item.day}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Quick Operational Shortcuts */}
        <div className="lg:col-span-4 saas-card p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-900">
            Ações Rápidas
          </h3>

          <div className="space-y-2.5">
            <button
              type="button"
              onClick={() => onNavigate('balcao')}
              className="w-full p-3 rounded-xl border border-teal-200 bg-teal-50/60 hover:bg-teal-50 flex items-center justify-between text-left transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold">
                  <QrCode className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-teal-900">Abrir Caixa / Balcão</h4>
                  <p className="text-[11px] text-teal-700">Carimbar selo ou emitir convite</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-teal-600 group-hover:translate-x-0.5 transition-transform" />
            </button>

            <button
              type="button"
              onClick={() => onNavigate('novo-cartao')}
              className="w-full p-3 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 flex items-center justify-between text-left transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
                  <Palette className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Personalizar Cartão</h4>
                  <p className="text-[11px] text-slate-500">Cores, recompensas e selos</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </button>

            <button
              type="button"
              onClick={() => onNavigate('campanhas')}
              className="w-full p-3 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 flex items-center justify-between text-left transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
                  <Megaphone className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Disparar Notificação Push</h4>
                  <p className="text-[11px] text-slate-500">Alerta na tela da Apple/Google</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>
      </div>

      {/* Real-time Activity Feed */}
      <div className="saas-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-bold text-slate-900">
              Atividades Recentes no Ponto de Venda
            </h3>
          </div>
          <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Ao vivo
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {recentActivities.map((act) => (
            <div key={act.id} className="py-3 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-xs">
                  {act.customer.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-slate-900">{act.customer}</p>
                  <p className="text-slate-500 text-[11px]">{act.action}</p>
                </div>
              </div>

              <div className="text-right">
                <span className="font-mono font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded text-[11px] block">
                  {act.stamps}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">{act.time}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
