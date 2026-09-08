import React, { useState } from 'react';
import { 
  ChevronRight, Users, Search, Download, Plus, 
  ArrowUpRight, Info, CheckCircle2, QrCode, 
  MoreVertical, Filter, Smartphone, Mail, Phone,
  Sparkles, RefreshCw, Send, AlertCircle
} from 'lucide-react';
import { demoCustomers, CustomerRecord, stampCard } from '../services/mockData.js';

interface CustomersCRMProps {
  onNavigateToCounter: () => void;
}

export const CustomersCRM: React.FC<CustomersCRMProps> = ({ onNavigateToCounter }) => {
  const [customers, setCustomers] = useState<CustomerRecord[]>(demoCustomers);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCohort, setSelectedCohort] = useState<string>('all');
  const [showWinBackModal, setShowWinBackModal] = useState(false);
  const [winBackSuccess, setWinBackSuccess] = useState(false);
  const [stampingId, setStampingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Filter customers
  const filteredCustomers = customers.filter(c => {
    const matchesSearch = 
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery) ||
      c.serial.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (selectedCohort === 'all') return true;
    return c.cohort === selectedCohort;
  });

  // Calculate cohort counts
  const countHabitual = customers.filter(c => c.cohort === 'habitual').length;
  const countRecorrente = customers.filter(c => c.cohort === 'recorrente').length;
  const countNovo = customers.filter(c => c.cohort === 'novo').length;
  const countAusente = customers.filter(c => c.cohort === 'ausente').length;
  const countPerdido = customers.filter(c => c.cohort === 'perdido').length;

  const handleFastStamp = async (customer: CustomerRecord) => {
    try {
      setStampingId(customer.id);
      await stampCard(customer.serial);
      setCustomers(prev => prev.map(c => {
        if (c.id === customer.id) {
          const newStamps = Math.min(c.stamps + 1, 10);
          return {
            ...c,
            stamps: newStamps,
            totalVisits: c.totalVisits + 1,
            lastVisit: 'Agora mesmo',
            rewardAvailable: newStamps >= 10
          };
        }
        return c;
      }));
      setToastMessage(`Selo carimbado para ${customer.name}!`);
      setTimeout(() => setToastMessage(null), 4000);
    } catch (e: any) {
      alert(e.message || 'Erro ao carimbar');
    } finally {
      setStampingId(null);
    }
  };

  const handleExportCSV = () => {
    const headers = 'ID,Nome,Email,Telefone,Selos,Ciclo,Status,UltimaVisita\n';
    const rows = customers.map(c => 
      `"${c.id}","${c.name}","${c.email}","${c.phone}","${c.stamps}/10","Ciclo ${c.cycle}","${c.cohort}","${c.lastVisit}"`
    ).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `mimo-clientes-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSendWinBackCampaign = () => {
    setWinBackSuccess(true);
    setTimeout(() => {
      setWinBackSuccess(false);
      setShowWinBackModal(false);
      setToastMessage('Notificação push enviada para os 2 clientes ausentes!');
      setTimeout(() => setToastMessage(null), 4000);
    }, 1200);
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Toast alert */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 text-xs font-bold animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Breadcrumb and Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium mb-1">
            <span>Início</span>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-slate-700 font-semibold">Clientes</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Clientes
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCSV}
            className="btn-outline-subtle text-xs font-semibold py-2 px-3"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar CSV</span>
          </button>
          <button
            type="button"
            onClick={onNavigateToCounter}
            className="btn-primary-teal text-xs font-bold py-2 px-3.5"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Cliente no Balcão</span>
          </button>
        </div>
      </div>

      {/* Community Health Summary (Matching screenshot 2) */}
      <div className="saas-card p-5 space-y-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-800">
            <span className="text-sm font-bold text-slate-900">Saúde da comunidade</span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-600">30 clientes</span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-600">Os clientes voltam a cada ~7 dias</span>
            <button 
              type="button"
              onClick={() => alert('Fórmula de retorno: calcula a média de dias entre selos carimbados.')}
              className="text-teal-600 hover:text-teal-800 hover:underline flex items-center gap-1 ml-1 text-xs"
            >
              <Info className="w-3.5 h-3.5" />
              <span>Como funciona →</span>
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            1 dos seus 24 clientes estabelecidos visitaram nos últimos 14 dias. Os clientes novos ainda não são contados. Com base nas suas configurações (<span className="text-teal-600 cursor-pointer hover:underline">alterar</span>)
          </p>
        </div>

        {/* 5 Segmented Metric Cohort Cards in a row (Matching screenshot 2) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          {/* 1. Habituais (Soft green) */}
          <div 
            onClick={() => setSelectedCohort(selectedCohort === 'habitual' ? 'all' : 'habitual')}
            className={`cohort-card-habitual cursor-pointer transition-all ${
              selectedCohort === 'habitual' ? 'ring-2 ring-emerald-500 shadow-sm' : ''
            }`}
          >
            <div className="text-2xl sm:text-3xl font-black text-emerald-700">
              {countHabitual}
            </div>
            <div className="text-xs font-bold text-emerald-800 mt-1">
              Habituais
            </div>
            <div className="text-[11px] text-emerald-600 font-medium mt-0.5">
              32%
            </div>
          </div>

          {/* 2. Recorrentes (Soft sky blue) */}
          <div 
            onClick={() => setSelectedCohort(selectedCohort === 'recorrente' ? 'all' : 'recorrente')}
            className={`cohort-card-recorrente cursor-pointer transition-all ${
              selectedCohort === 'recorrente' ? 'ring-2 ring-sky-500 shadow-sm' : ''
            }`}
          >
            <div className="text-2xl sm:text-3xl font-black text-sky-700">
              {countRecorrente}
            </div>
            <div className="text-xs font-bold text-sky-800 mt-1">
              Recorrentes
            </div>
            <div className="text-[11px] text-sky-600 font-medium mt-0.5">
              0%
            </div>
          </div>

          {/* 3. Novos (Soft purple) */}
          <div 
            onClick={() => setSelectedCohort(selectedCohort === 'novo' ? 'all' : 'novo')}
            className={`cohort-card-novo cursor-pointer transition-all ${
              selectedCohort === 'novo' ? 'ring-2 ring-purple-500 shadow-sm' : ''
            }`}
          >
            <div className="text-2xl sm:text-3xl font-black text-purple-700">
              {countNovo}
            </div>
            <div className="text-xs font-bold text-purple-800 mt-1">
              Novos
            </div>
            <div className="text-[11px] text-purple-600 font-medium mt-0.5">
              20%
            </div>
          </div>

          {/* 4. Ausentes (Soft yellow/amber with Recuperá-los link) */}
          <div 
            onClick={() => setSelectedCohort(selectedCohort === 'ausente' ? 'all' : 'ausente')}
            className={`cohort-card-ausente cursor-pointer transition-all ${
              selectedCohort === 'ausente' ? 'ring-2 ring-amber-500 shadow-sm' : ''
            }`}
          >
            <div className="text-2xl sm:text-3xl font-black text-amber-700">
              {countAusente}
            </div>
            <div className="text-xs font-bold text-amber-800 mt-1">
              Ausentes
            </div>
            <div className="text-[11px] text-amber-600 font-medium mt-0.5">
              7%
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowWinBackModal(true);
              }}
              className="mt-2 text-[11px] font-bold text-amber-700 hover:text-amber-900 hover:underline flex items-center gap-1"
            >
              <ArrowUpRight className="w-3 h-3" />
              <span>Recuperá-los</span>
            </button>
          </div>

          {/* 5. Perdidos (Soft rose/red) */}
          <div 
            onClick={() => setSelectedCohort(selectedCohort === 'perdido' ? 'all' : 'perdido')}
            className={`cohort-card-perdido cursor-pointer transition-all ${
              selectedCohort === 'perdido' ? 'ring-2 ring-rose-500 shadow-sm' : ''
            }`}
          >
            <div className="text-2xl sm:text-3xl font-black text-rose-700">
              {countPerdido}
            </div>
            <div className="text-xs font-bold text-rose-800 mt-1">
              Perdidos
            </div>
            <div className="text-[11px] text-rose-600 font-medium mt-0.5">
              7%
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome, e-mail, telefone ou serial..."
            className="input-saas pl-10 text-xs sm:text-sm py-2"
          />
        </div>

        {/* Cohort Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'all', label: 'Todos', count: customers.length },
            { id: 'habitual', label: 'Habituais', count: countHabitual },
            { id: 'novo', label: 'Novos', count: countNovo },
            { id: 'ausente', label: 'Ausentes', count: countAusente },
            { id: 'perdido', label: 'Perdidos', count: countPerdido },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedCohort(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedCohort === tab.id
                  ? 'bg-slate-900 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
      </div>

      {/* Customer List (Responsive Table on Desktop & Cards on Mobile) */}
      <div className="saas-card overflow-hidden">
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Cliente</th>
                <th className="py-3 px-4">Contato</th>
                <th className="py-3 px-4">Selos Acumulados</th>
                <th className="py-3 px-4">Ciclo</th>
                <th className="py-3 px-4">Segmento</th>
                <th className="py-3 px-4">Última Visita</th>
                <th className="py-3 px-4 text-right">Ação Rápida</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400 text-xs">
                    Nenhum cliente encontrado com os filtros atuais.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-800 font-bold flex items-center justify-center text-xs shrink-0">
                          {customer.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{customer.name}</p>
                          <p className="text-[11px] font-mono text-slate-400">{customer.serial}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-slate-600">{customer.email}</p>
                      <p className="text-[11px] text-slate-400">{customer.phone}</p>
                    </td>
                    <td className="py-3 px-4">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-slate-800 font-mono">
                            {customer.stamps} / 10
                          </span>
                          {customer.stamps >= 10 && (
                            <span className="text-[10px] font-extrabold text-amber-600 bg-amber-50 px-1.5 py-0.2 rounded">
                              RECOMPENSA!
                            </span>
                          )}
                        </div>
                        <div className="w-24 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${
                              customer.stamps >= 10 ? 'bg-amber-400' : 'bg-teal-500'
                            }`}
                            style={{ width: `${(customer.stamps / 10) * 100}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-700">
                      #{customer.cycle}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        customer.cohort === 'habitual' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        customer.cohort === 'novo' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                        customer.cohort === 'ausente' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                        customer.cohort === 'perdido' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {customer.cohort.charAt(0).toUpperCase() + customer.cohort.slice(1)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-[11px]">
                      {customer.lastVisit}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleFastStamp(customer)}
                        disabled={stampingId === customer.id}
                        className="btn-primary-teal text-xs py-1.5 px-3 font-semibold"
                      >
                        {stampingId === customer.id ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : (
                          <span>+1 Selo</span>
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards (Optimized for smartphones) */}
        <div className="md:hidden divide-y divide-slate-100">
          {filteredCustomers.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              Nenhum cliente encontrado.
            </div>
          ) : (
            filteredCustomers.map((customer) => (
              <div key={customer.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-teal-100 text-teal-800 font-bold flex items-center justify-center text-xs shrink-0">
                      {customer.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{customer.name}</h4>
                      <span className="text-[10px] text-slate-400 font-mono">{customer.email}</span>
                    </div>
                  </div>

                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    customer.cohort === 'habitual' ? 'bg-emerald-50 text-emerald-700' :
                    customer.cohort === 'novo' ? 'bg-purple-50 text-purple-700' :
                    customer.cohort === 'ausente' ? 'bg-amber-50 text-amber-700' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {customer.cohort}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-50">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Selos Acumulados</span>
                    <span className="font-bold text-slate-900 font-mono">{customer.stamps} / 10 selos</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleFastStamp(customer)}
                    disabled={stampingId === customer.id}
                    className="btn-primary-teal text-xs py-1.5 px-3 font-semibold"
                  >
                    +1 Selo Balcão
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Win-Back Modal (Triggered by "Recuperá-los") */}
      {showWinBackModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                  <ArrowUpRight className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Recuperar Clientes Ausentes</h3>
                  <p className="text-[11px] text-slate-500">2 clientes não visitam sua loja há mais de 14 dias</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowWinBackModal(false)}
                className="text-slate-400 hover:text-slate-700 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Dispare uma notificação push que acende na tela de bloqueio da <strong>Apple Wallet</strong> e <strong>Google Wallet</strong> dos clientes ausentes com um incentivo especial:
            </p>

            <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/70 space-y-2">
              <span className="text-[10px] font-bold uppercase text-amber-800 tracking-wider block">
                Prévia da Notificação na Tela de Bloqueio
              </span>
              <p className="text-xs font-semibold text-slate-800">
                🍰 <strong>NOX Dessert Club:</strong> Sentimos sua falta! Ganhe 1 selo bônus em dobro na sua próxima visita até domingo.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowWinBackModal(false)}
                className="btn-outline-subtle text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSendWinBackCampaign}
                disabled={winBackSuccess}
                className="btn-primary-teal text-xs font-bold flex items-center gap-2"
              >
                {winBackSuccess ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>{winBackSuccess ? 'Enviando...' : 'Enviar Push Agora'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
