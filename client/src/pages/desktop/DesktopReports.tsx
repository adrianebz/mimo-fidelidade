import React, { useState } from 'react';
import { 
  BarChart3, Download, Calendar, ArrowUpRight, 
  TrendingUp, Users, Award, Sparkles, Filter
} from 'lucide-react';

export const DesktopReports: React.FC = () => {
  const [period, setPeriod] = useState('30d');

  const reportData = [
    { period: 'Setembro 2026 (Atual)', stamps: 342, rewards: 28, newCustomers: 45, retention: '72.4%' },
    { period: 'Agosto 2026', stamps: 1240, rewards: 96, newCustomers: 120, retention: '68.1%' },
    { period: 'Julho 2026', stamps: 1110, rewards: 84, newCustomers: 98, retention: '64.5%' },
    { period: 'Junho 2026', stamps: 890, rewards: 62, newCustomers: 85, retention: '61.0%' },
    { period: 'Maio 2026', stamps: 660, rewards: 48, newCustomers: 64, retention: '58.2%' },
  ];

  const handleExport = () => {
    const csv = 'Periodo,Selos,Recompensas,NovosClientes,Retencao\n' +
      reportData.map(r => `"${r.period}",${r.stamps},${r.rewards},${r.newCustomers},"${r.retention}"`).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-mimo-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/8 pb-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Relatórios Analíticos
          </h1>
          <p className="text-xs text-white/50 mt-0.5">
            Métricas consolidadas de frequência, novos clientes e resgate de prêmios
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="input-mimo-dark text-xs py-2 w-44"
          >
            <option value="30d">Últimos 30 dias</option>
            <option value="90d">Último trimestre</option>
            <option value="year">Ano de 2026</option>
          </select>

          <button
            type="button"
            onClick={handleExport}
            className="btn-mimo-outline text-xs font-bold py-2 px-3.5 flex items-center gap-2"
          >
            <Download className="w-3.5 h-3.5 text-[#FFC82C]" />
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* 4 Metric Cards (Matching Screen 5) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="mimo-card p-5">
          <span className="text-xs font-bold text-white/50 uppercase tracking-wider block">
            Selos Totais
          </span>
          <div className="text-3xl font-black text-white mt-1">
            4.242
          </div>
          <div className="flex items-center gap-1 text-xs text-emerald-400 font-bold mt-2">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>+14% acumulado</span>
          </div>
        </div>

        <div className="mimo-card p-5">
          <span className="text-xs font-bold text-white/50 uppercase tracking-wider block">
            Clientes Frequentes
          </span>
          <div className="text-3xl font-black text-[#FFC82C] mt-1">
            34
          </div>
          <div className="flex items-center gap-1 text-xs text-emerald-400 font-bold mt-2">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Visitam a cada 7 dias</span>
          </div>
        </div>

        <div className="mimo-card p-5">
          <span className="text-xs font-bold text-white/50 uppercase tracking-wider block">
            Retorno em 14 dias
          </span>
          <div className="text-3xl font-black text-blue-400 mt-1">
            72.4%
          </div>
          <div className="flex items-center gap-1 text-xs text-emerald-400 font-bold mt-2">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Alta fidelização</span>
          </div>
        </div>

        <div className="mimo-card p-5">
          <span className="text-xs font-bold text-white/50 uppercase tracking-wider block">
            Total Recompensas
          </span>
          <div className="text-3xl font-black text-emerald-400 mt-1">
            120
          </div>
          <div className="flex items-center gap-1 text-xs text-emerald-400 font-bold mt-2">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Cafés entregues</span>
          </div>
        </div>
      </div>

      {/* Analytics Breakdown Table (Matching Screen 5) */}
      <div className="mimo-card overflow-hidden">
        <div className="p-4 border-b border-white/8 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">
            Histórico Mensal de Desempenho
          </h3>
          <span className="text-xs text-white/50">
            Valores atualizados em tempo real pelo motor MIMO
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-black/30 border-b border-white/8 text-white/50 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-4">Mês / Período</th>
                <th className="py-3.5 px-4">Selos Emitidos</th>
                <th className="py-3.5 px-4">Recompensas Entregues</th>
                <th className="py-3.5 px-4">Novos Cadastros</th>
                <th className="py-3.5 px-4 text-right">Taxa de Retorno</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/6 text-white/80">
              {reportData.map((row) => (
                <tr key={row.period} className="hover:bg-white/5 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-white">
                    {row.period}
                  </td>
                  <td className="py-3.5 px-4 font-mono font-bold text-[#FFC82C]">
                    {row.stamps} selos
                  </td>
                  <td className="py-3.5 px-4 font-mono font-bold text-emerald-400">
                    {row.rewards} entregues
                  </td>
                  <td className="py-3.5 px-4 font-mono">
                    +{row.newCustomers} clientes
                  </td>
                  <td className="py-3.5 px-4 text-right font-bold text-emerald-400">
                    {row.retention}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
