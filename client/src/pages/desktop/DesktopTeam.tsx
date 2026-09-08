import React, { useState } from 'react';
import { 
  UserCheck, Plus, Search, CheckCircle2, 
  ShieldCheck, Clock, Award, MoreVertical, Sparkles
} from 'lucide-react';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  shift: string;
  stampsGiven: number;
  status: 'Ativo' | 'Inativo';
}

export const DesktopTeam: React.FC = () => {
  const [team, setTeam] = useState<TeamMember[]>([
    {
      id: '1',
      name: 'Thiago Silva',
      email: 'thiago.silva@padaria.com',
      role: 'Gerente da Loja',
      shift: 'Manhã',
      stampsGiven: 142,
      status: 'Ativo'
    },
    {
      id: '2',
      name: 'Carla Santos',
      email: 'carla.santos@padaria.com',
      role: 'Atendente Balcão',
      shift: 'Tarde',
      stampsGiven: 98,
      status: 'Ativo'
    },
    {
      id: '3',
      name: 'João Paulo',
      email: 'joao.paulo@padaria.com',
      role: 'Operador Caixa',
      shift: 'Integral',
      stampsGiven: 67,
      status: 'Ativo'
    },
    {
      id: '4',
      name: 'Lucas Mendes',
      email: 'lucas.mendes@padaria.com',
      role: 'Atendente Balcão',
      shift: 'Manhã',
      stampsGiven: 35,
      status: 'Ativo'
    }
  ]);

  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [newMember, setNewMember] = useState({ name: '', email: '', role: 'Atendente Balcão', shift: 'Manhã' });

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    setTeam(prev => [
      ...prev,
      {
        id: String(Date.now()),
        name: newMember.name,
        email: newMember.email,
        role: newMember.role,
        shift: newMember.shift,
        stampsGiven: 0,
        status: 'Ativo'
      }
    ]);
    setShowModal(false);
    setNewMember({ name: '', email: '', role: 'Atendente Balcão', shift: 'Manhã' });
  };

  const filtered = team.filter(m => 
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/8 pb-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Minha Equipe
          </h1>
          <p className="text-xs text-white/50 mt-0.5">
            Gerencie os atendentes e operadores autorizados a carimbar selos no balcão
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="btn-mimo-yellow text-xs font-bold py-2.5 px-4"
        >
          <Plus className="w-4 h-4" />
          <span>Convidar Atendente</span>
        </button>
      </div>

      {/* Team Table (Matching Screen 3) */}
      <div className="mimo-card overflow-hidden">
        <div className="p-4 border-b border-white/8 flex items-center justify-between">
          <div className="relative w-72">
            <Search className="w-3.5 h-3.5 text-white/40 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar atendente por nome ou cargo..."
              className="input-mimo-dark pl-9 text-xs py-2"
            />
          </div>

          <span className="text-xs text-white/50">
            {team.length} membros cadastrados
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-black/30 border-b border-white/8 text-white/50 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-4">Membro</th>
                <th className="py-3.5 px-4">Cargo</th>
                <th className="py-3.5 px-4">Turno</th>
                <th className="py-3.5 px-4">Selos Aplicados</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/6 text-white/80">
              {filtered.map((member) => (
                <tr key={member.id} className="hover:bg-white/5 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-white/10 text-[#FFC82C] font-bold flex items-center justify-center text-xs">
                        {member.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-white">{member.name}</p>
                        <p className="text-[11px] text-white/40">{member.email}</p>
                      </div>
                    </div>
                  </td>

                  <td className="py-3.5 px-4 font-semibold text-white/80">
                    {member.role}
                  </td>

                  <td className="py-3.5 px-4 text-white/60">
                    {member.shift}
                  </td>

                  <td className="py-3.5 px-4">
                    <span className="font-mono font-bold text-[#FFC82C] bg-[#FFC82C]/10 px-2 py-0.5 rounded text-xs border border-[#FFC82C]/20">
                      {member.stampsGiven} selos
                    </span>
                  </td>

                  <td className="py-3.5 px-4">
                    <span className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full text-[10px] font-bold">
                      {member.status}
                    </span>
                  </td>

                  <td className="py-3.5 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => alert(`Editar permissões de ${member.name}`)}
                      className="text-xs text-white/50 hover:text-white font-semibold hover:underline"
                    >
                      Editar →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Member Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#16161A] border border-white/15 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-bold text-white">Convidar Novo Atendente</h3>
              <button 
                type="button" 
                onClick={() => setShowModal(false)}
                className="text-white/40 hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddMember} className="space-y-3">
              <div>
                <label className="text-xs font-bold uppercase text-white/60 block mb-1">
                  Nome Completo
                </label>
                <input
                  type="text"
                  required
                  value={newMember.name}
                  onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                  placeholder="Ex: Fernanda Lima"
                  className="input-mimo-dark text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-white/60 block mb-1">
                  E-mail
                </label>
                <input
                  type="email"
                  required
                  value={newMember.email}
                  onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                  placeholder="atendente@padariacentral.com"
                  className="input-mimo-dark text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase text-white/60 block mb-1">
                    Cargo
                  </label>
                  <select
                    value={newMember.role}
                    onChange={(e) => setNewMember({ ...newMember, role: e.target.value })}
                    className="input-mimo-dark text-xs"
                  >
                    <option value="Atendente Balcão">Atendente Balcão</option>
                    <option value="Operador Caixa">Operador Caixa</option>
                    <option value="Gerente da Loja">Gerente da Loja</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-white/60 block mb-1">
                    Turno
                  </label>
                  <select
                    value={newMember.shift}
                    onChange={(e) => setNewMember({ ...newMember, shift: e.target.value })}
                    className="input-mimo-dark text-xs"
                  >
                    <option value="Manhã">Manhã</option>
                    <option value="Tarde">Tarde</option>
                    <option value="Noite">Noite</option>
                    <option value="Integral">Integral</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-mimo-outline text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-mimo-yellow text-xs font-bold"
                >
                  Salvar e Convidar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
