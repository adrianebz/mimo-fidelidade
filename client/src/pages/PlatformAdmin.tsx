import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, Plus, CheckCircle2, Server, Activity, 
  Store, ChevronRight, RefreshCw, Key, ArrowUpRight
} from 'lucide-react';
import * as mock from '../services/mockData.js';

export const PlatformAdmin: React.FC = () => {
  const [organizations, setOrganizations] = useState<mock.Organization[]>([]);
  const [showNewOrgModal, setShowNewOrgModal] = useState(false);
  const [formData, setFormData] = useState({
    legalName: '',
    publicName: '',
    slug: '',
    plan: 'starter' as 'starter' | 'pro' | 'unlimited',
    ownerName: '',
    ownerEmail: '',
    rewardLabel: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const fetchOrgs = async () => {
    const data = await mock.fetchOrganizations();
    setOrganizations(data);
  };

  useEffect(() => {
    fetchOrgs();
  }, []);

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFeedback(null);

    try {
      const data = await mock.createOrganization(formData);
      setFeedback(`Organização "${data.org.publicName}" criada e ativada com sucesso!`);
      setShowNewOrgModal(false);
      setFormData({
        legalName: '',
        publicName: '',
        slug: '',
        plan: 'starter',
        ownerName: '',
        ownerEmail: '',
        rewardLabel: ''
      });
      fetchOrgs();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium mb-1">
            <span>Início</span>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-slate-700 font-semibold">Superadmin da Plataforma</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Governança Multiempresa MIMO
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Gestão global de lojistas, isolamento de dados e monitoramento de infraestrutura.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowNewOrgModal(true)}
          className="btn-primary-teal text-xs font-bold py-2.5 px-4"
        >
          <Plus className="w-4 h-4" />
          <span>Cadastrar Novo Lojista</span>
        </button>
      </div>

      {feedback && (
        <div className="bg-emerald-50 border border-emerald-300 p-4 rounded-xl text-emerald-900 text-xs font-bold flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* System Health */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="saas-card p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-bold uppercase text-slate-400 block">Status da Rede</span>
            <div className="text-base font-bold text-slate-900">Operacional 100%</div>
            <span className="text-[11px] text-emerald-600 font-semibold">Fastify • Firestore • BR</span>
          </div>
        </div>

        <div className="saas-card p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-bold uppercase text-slate-400 block">Lojas Ativas</span>
            <div className="text-base font-bold text-slate-900">{organizations.length} Organizações</div>
            <span className="text-[11px] text-teal-600 font-semibold">Multi-tenant Isolado</span>
          </div>
        </div>

        <div className="saas-card p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-bold uppercase text-slate-400 block">Certificados Wallet</span>
            <div className="text-base font-bold text-slate-900">Apple & Google Válidos</div>
            <span className="text-[11px] text-blue-600 font-semibold">Assinatura SHA-1 & JWT OK</span>
          </div>
        </div>
      </div>

      {/* Organizations List */}
      <div className="saas-card overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">
            Lojas e Marcas Conectadas
          </h3>
          <span className="text-xs text-slate-500">
            Cada organização possui subcollections próprias e isoladas
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Marca</th>
                <th className="py-3 px-4">Razão Social</th>
                <th className="py-3 px-4">Plano</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Criado em</th>
                <th className="py-3 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {organizations.map((org) => (
                <tr key={org.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-slate-900">{org.publicName}</td>
                  <td className="py-3.5 px-4 text-slate-500">{org.legalName}</td>
                  <td className="py-3.5 px-4">
                    <span className="uppercase font-bold text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">
                      {org.plan}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold text-[10px] border border-emerald-200">
                      Ativo
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">
                    {new Date(org.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => alert(`Configurações de ${org.publicName} abertas.`)}
                      className="text-xs font-semibold text-teal-600 hover:text-teal-800 hover:underline"
                    >
                      Gerenciar →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Org Modal */}
      {showNewOrgModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Cadastrar Novo Lojista</h3>
              <button 
                type="button" 
                onClick={() => setShowNewOrgModal(false)}
                className="text-slate-400 hover:text-slate-700 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateOrg} className="space-y-3">
              <div>
                <label className="text-xs font-bold uppercase text-slate-600 block mb-1">
                  Nome Fantasia
                </label>
                <input
                  type="text"
                  required
                  value={formData.publicName}
                  onChange={(e) => setFormData({ ...formData, publicName: e.target.value })}
                  placeholder="Ex: NOX Dessert Club"
                  className="input-saas"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-slate-600 block mb-1">
                  Razão Social
                </label>
                <input
                  type="text"
                  required
                  value={formData.legalName}
                  onChange={(e) => setFormData({ ...formData, legalName: e.target.value })}
                  placeholder="Ex: NOX Alimentos Ltda"
                  className="input-saas"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-slate-600 block mb-1">
                  E-mail do Lojista (Admin)
                </label>
                <input
                  type="email"
                  required
                  value={formData.ownerEmail}
                  onChange={(e) => setFormData({ ...formData, ownerEmail: e.target.value })}
                  placeholder="lojista@empresa.com"
                  className="input-saas"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNewOrgModal(false)}
                  className="btn-outline-subtle text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-primary-teal text-xs font-bold"
                >
                  {isSubmitting ? 'Salvando...' : 'Ativar Organização'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
