import React from 'react';
import { 
  Users, Sparkles, Award, TrendingUp, 
  ArrowUpRight, Clock, CheckCircle2, ChevronRight
} from 'lucide-react';

export const DesktopOverview: React.FC = () => {
  const chartDays = [
    { day: 'Seg', stamps: 28 },
    { day: 'Ter', stamps: 34 },
    { day: 'Qua', stamps: 32 },
    { day: 'Qui', stamps: 48 },
    { day: 'Sex', stamps: 68 },
    { day: 'Sáb', stamps: 74 },
    { day: 'Dom', stamps: 58 },
  ];

  const maxStamps = 80;

  const activities = [
    { id: 1, customer: 'Mariana Silva', action: '+1 Selo aplicado no balcão', time: 'Há 5 min', stamps: '9/10', color: '#FFC82C' },
    { id: 2, customer: 'Carlos Souza', action: '+1 Selo aplicado no balcão', time: 'Há 18 min', stamps: '4/10', color: '#FFC82C' },
    { id: 3, customer: 'Ana Costa', action: 'Resgatou 1 Café Espresso Grátis!', time: 'Há 42 min', stamps: '10/10', color: '#10B981' },
    { id: 4, customer: 'Lucas Ferreira', action: 'Novo cliente cadastrado via QR', time: 'Há 1 hora', stamps: '1/10', color: '#38BDF8' },
    { id: 5, customer: 'Beatriz Lima', action: '+1 Selo aplicado no balcão', time: 'Há 2 horas', stamps: '7/10', color: '#FFC82C' },
    { id: 6, customer: 'Gabriel Santos', action: '+1 Selo aplicado no balcão', time: 'Há 3 horas', stamps: '3/10', color: '#FFC82C' },
  ];

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* 4 KPI Cards (Matching Screen 1) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="mimo-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white/50 uppercase tracking-wider">
              Total Clientes
            </span>
            <div className="w-8 h-8 rounded-lg bg-white/5 text-[#FFC82C] flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-white mt-2">
            1.240
          </div>
          <div className="flex items-center gap-1 text-xs text-emerald-400 font-bold mt-2">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>+12% este mês</span>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="mimo-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white/50 uppercase tracking-wider">
              Selos Emitidos
            </span>
            <div className="w-8 h-8 rounded-lg bg-white/5 text-[#FFC82C] flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-[#FFC82C] mt-2">
            342
          </div>
          <div className="flex items-center gap-1 text-xs text-emerald-400 font-bold mt-2">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>+18% na semana</span>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="mimo-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white/50 uppercase tracking-wider">
              Recompensas
            </span>
            <div className="w-8 h-8 rounded-lg bg-white/5 text-emerald-400 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-emerald-400 mt-2">
            89
          </div>
          <div className="flex items-center gap-1 text-xs text-emerald-400 font-bold mt-2">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>+5% resgatados</span>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="mimo-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white/50 uppercase tracking-wider">
              Taxa Retenção
            </span>
            <div className="w-8 h-8 rounded-lg bg-white/5 text-blue-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-white mt-2">
            68%
          </div>
          <div className="flex items-center gap-1 text-xs text-emerald-400 font-bold mt-2">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>+8% frequência média</span>
          </div>
        </div>
      </div>

      {/* Main Row: Chart & Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Chart: Selos Distribuídos na Semana */}
        <div className="lg:col-span-8 mimo-card p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-white/8 pb-4">
            <div>
              <h3 className="text-base font-bold text-white">
                Selos Distribuídos na Semana
              </h3>
              <p className="text-xs text-white/50 mt-0.5">
                Acompanhamento diário de carimbos realizados no balcão
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-[#FFC82C] bg-[#FFC82C]/10 border border-[#FFC82C]/20 px-3 py-1 rounded-full">
              <span>● Total: 342 selos</span>
            </div>
          </div>

          {/* Bar Chart */}
          <div className="pt-6 pb-2">
            <div className="h-56 flex items-end justify-between gap-3 sm:gap-6 px-4 border-b border-white/8">
              {chartDays.map((item) => {
                const heightPercent = (item.stamps / maxStamps) * 100;
                return (
                  <div key={item.day} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                    <div className="w-full flex items-end justify-center h-full">
                      <div
                        className="w-full max-w-[36px] bg-[#FFC82C] rounded-t-lg group-hover:bg-amber-300 transition-all duration-300 shadow-md shadow-[#FFC82C]/20 relative"
                        style={{ height: `${heightPercent}%` }}
                      >
                        <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-black/90 text-[#FFC82C] text-[10px] font-bold px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-white/10">
                          {item.stamps} selos
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-white/60 mt-1">
                      {item.day}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Card: Atividade Recente */}
        <div className="lg:col-span-4 mimo-card p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-white/8 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#FFC82C]" />
              <h3 className="text-base font-bold text-white">
                Atividade Recente
              </h3>
            </div>
            <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Tempo Real
            </span>
          </div>

          <div className="divide-y divide-white/8 space-y-2">
            {activities.map((act) => (
              <div key={act.id} className="pt-2.5 pb-1 flex items-start justify-between gap-3 text-xs">
                <div className="flex items-start gap-2.5 min-w-0">
                  <span
                    className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                    style={{ backgroundColor: act.color }}
                  />
                  <div className="min-w-0">
                    <p className="font-bold text-white truncate">{act.customer}</p>
                    <p className="text-[11px] text-white/50 truncate">{act.action}</p>
                    <span className="text-[10px] text-white/30">{act.time}</span>
                  </div>
                </div>

                <span className="font-mono font-bold text-[#FFC82C] bg-[#FFC82C]/10 border border-[#FFC82C]/20 px-2 py-0.5 rounded text-[11px] shrink-0">
                  {act.stamps}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
