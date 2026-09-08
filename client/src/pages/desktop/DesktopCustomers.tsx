import React, { useState } from 'react';
import { 
  Users, Search, Filter, Plus, CheckCircle2, 
  Phone, Mail, Calendar, Sparkles, QrCode, ArrowUpRight
} from 'lucide-react';

interface CustomerItem {
  id: string;
  name: string;
  email: string;
  phone: string;
  stamps: number;
  cycle: number;
  status: string;
  tag: string;
  createdAt: string;
  lastVisit: string;
}

export const DesktopCustomers: React.FC = () => {
  const [customers, setCustomers] = useState<CustomerItem[]>([
    {
      id: '1',
      name: 'Mariana Silva',
      email: 'mariana.silva@email.com',
      phone: '(11) 98765-4321',
      stamps: 9,
      cycle: 1,
      status: 'Ativo',
      tag: 'Cliente Fiel',
      createdAt: '14/05/2026',
      lastVisit: 'Hoje, às 14:32'
    },
    {
      id: '2',
      name: 'Carlos Souza',
      email: 'carlos.souza@email.com',
      phone: '(11) 97654-3210',
      stamps: 4,
      cycle: 1,
      status: 'Ativo',
      tag: 'Recorrente',
      createdAt: '02/06/2026',
      lastVisit: 'Ontem, às 16:15'
    },
    {
      id: '3',
      name: 'Ana Costa',
      email: 'ana.costa@email.com',
      phone: '(21) 99876-5432',
      stamps: 10,
      cycle: 2,
      status: 'Recompensa',
      tag: 'VIP',
      createdAt: '10/04/2026',
      lastVisit: 'Há 2 dias'
    },
    {
      id: '4',
      name: 'Lucas Ferreira',
      email: 'lucas.ferreira@email.com',
      phone: '(11) 96543-2109',
      stamps: 1,
      cycle: 1,
      status: 'Novo',
      tag: 'Novo Cliente',
      createdAt: '04/09/2026',
      lastVisit: 'Há 3 dias'
    },
    {
      id: '5',
      name: 'Beatriz Lima',
      email: 'beatriz.lima@email.com',
      phone: '(19) 97788-9900',
      stamps: 7,
      cycle: 1,
      status: 'Ativo',
      tag: 'Cliente Fiel',
      createdAt: '22/07/2026',
      lastVisit: 'Há 4 dias'
    },
    {
      id: '6',
      name: 'Gabriel Santos',
      email: 'gabriel.santos@email.com',
      phone: '(11) 94433-2211',
      stamps: 3,
      cycle: 1,
      status: 'Ativo',
      tag: 'Recorrente',
      createdAt: '18/08/2026',
      lastVisit: 'Há 5 dias'
    }
  ]);

  const [selectedCustomer, setSelectedCustomer] = useState<CustomerItem>(customers[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [stampFeedback, setStampFeedback] = useState<string | null>(null);

  const handleStampCustomer = () => {
    if (!selectedCustomer) return;
    const newStamps = Math.min(selectedCustomer.stamps + 1, 10);
    const updated = { ...selectedCustomer, stamps: newStamps, lastVisit: 'Agora mesmo' };
    setSelectedCustomer(updated);
    setCustomers(prev => prev.map(c => c.id === updated.id ? updated : c));
    setStampFeedback(`+1 Selo carimbado para ${updated.name}!`);
    setTimeout(() => setStampFeedback(null), 3500);
  };

  const filtered = customers.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/8 pb-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Clientes
          </h1>
          <p className="text-xs text-white/50 mt-0.5">
            Gerencie sua base de fidelidade, histórico de visitas e cartões digitais
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-white/40 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar cliente..."
              className="input-mimo-dark pl-9 text-xs py-2 w-48 sm:w-64"
            />
          </div>

          <button
            type="button"
            onClick={() => alert('Para cadastrar cliente no balcão, utilize o QR Convite!')}
            className="btn-mimo-yellow text-xs font-bold py-2 px-3.5"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Cliente</span>
          </button>
        </div>
      </div>

      {stampFeedback && (
        <div className="p-3 bg-[#FFC82C]/15 border border-[#FFC82C]/40 rounded-xl text-[#FFC82C] text-xs font-bold flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-[#FFC82C]" />
          <span>{stampFeedback}</span>
        </div>
      )}

      {/* 2-Column Layout (Matching Screen 2) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Customer List Table (65%) */}
        <div className="lg:col-span-8 mimo-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-black/30 border-b border-white/8 text-white/50 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4">Cliente</th>
                  <th className="py-3.5 px-4">Selos</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Última Visita</th>
                  <th className="py-3.5 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6 text-white/80">
                {filtered.map((customer) => {
                  const isSelected = selectedCustomer.id === customer.id;
                  return (
                    <tr
                      key={customer.id}
                      onClick={() => setSelectedCustomer(customer)}
                      className={`cursor-pointer transition-colors ${
                        isSelected 
                          ? 'bg-[#FFC82C]/10 hover:bg-[#FFC82C]/15' 
                          : 'hover:bg-white/5'
                      }`}
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-white/10 text-white font-bold flex items-center justify-center text-xs shrink-0">
                            {customer.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-white">{customer.name}</p>
                            <p className="text-[11px] text-white/40">{customer.email}</p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-[#FFC82C] text-xs">
                            {customer.stamps}/10
                          </span>
                          <div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                customer.stamps >= 10 ? 'bg-emerald-400' : 'bg-[#FFC82C]'
                              }`}
                              style={{ width: `${(customer.stamps / 10) * 100}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          customer.stamps >= 10
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-white/10 text-white/70'
                        }`}>
                          {customer.stamps >= 10 ? 'Recompensa' : customer.status}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-white/50 text-[11px]">
                        {customer.lastVisit}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCustomer(customer);
                          }}
                          className="text-xs font-bold text-[#FFC82C] hover:underline"
                        >
                          Ver Perfil →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Selected Customer Card Drawer (35%) */}
        <div className="lg:col-span-4 mimo-card p-6 space-y-5 sticky top-32">
          {/* Header & Avatar */}
          <div className="text-center space-y-2 border-b border-white/8 pb-4">
            <div className="w-16 h-16 rounded-full bg-[#FFC82C] text-black font-black text-xl flex items-center justify-center mx-auto shadow-lg shadow-[#FFC82C]/20">
              {selectedCustomer.name.substring(0, 2).toUpperCase()}
            </div>
            <h3 className="text-lg font-bold text-white">
              {selectedCustomer.name}
            </h3>
            <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#FFC82C]/15 border border-[#FFC82C]/30 text-[#FFC82C] text-[11px] font-bold">
              {selectedCustomer.tag}
            </span>
          </div>

          {/* Contact Details */}
          <div className="space-y-2 text-xs text-white/70">
            <div className="flex items-center gap-2.5">
              <Phone className="w-3.5 h-3.5 text-white/40" />
              <span>{selectedCustomer.phone}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Mail className="w-3.5 h-3.5 text-white/40" />
              <span className="truncate">{selectedCustomer.email}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Calendar className="w-3.5 h-3.5 text-white/40" />
              <span>Cadastrado em {selectedCustomer.createdAt}</span>
            </div>
          </div>

          {/* Stamps Visual Grid */}
          <div className="p-4 bg-black/40 rounded-2xl border border-white/8 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-white uppercase text-[11px]">
                Saldo Atual
              </span>
              <span className="font-mono font-black text-[#FFC82C] text-sm">
                {selectedCustomer.stamps} / 10 Selos
              </span>
            </div>

            {/* 10 Visual Stamp Coins Grid */}
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
                const isStamped = num <= selectedCustomer.stamps;
                return (
                  <div
                    key={num}
                    className={`aspect-square rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      isStamped
                        ? 'bg-[#FFC82C] text-black shadow-sm shadow-[#FFC82C]/30'
                        : 'bg-white/5 border border-dashed border-white/20 text-white/20'
                    }`}
                  >
                    {isStamped ? (num === 10 ? '🎁' : '🪙') : num}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Stamping Action */}
          <button
            type="button"
            onClick={handleStampCustomer}
            className="btn-mimo-yellow w-full text-xs font-bold py-3.5 shadow-md flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>Carimbar Selo (+1)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
