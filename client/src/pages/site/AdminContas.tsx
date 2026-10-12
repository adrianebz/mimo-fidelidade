import React, { useState, useEffect } from 'react';
import {
  ShieldCheck, Store, Plus, Key, Eye, EyeOff, Edit3, Trash2,
  ExternalLink, Copy, CheckCircle2, AlertTriangle, RefreshCw,
  Search, Lock, Mail, ChevronRight, LogOut, Sparkles, X, UserCheck, ShieldAlert
} from 'lucide-react';
import {
  listarTodosLojistas,
  salvarLojistaFirestore,
  excluirLojistaFirestore,
  alternarStatusFinanceiroLojista,
  provisionarAcessoLojista,
  LojistaFirestoreData,
  MASTER_ADMIN_EMAIL
} from '../../services/boomiiWalletService.js';
import { SiteNavTab } from '../../components/SiteHeader.js';
import { urlCadastroCliente } from '../../siteConfig.js';
import {
  NOME_PLANO,
  ORDEM_PLANOS,
  PRECO_PLANO,
  PRECO_UNIDADE_EXTRA,
  mensalidadeDoPlano,
  normalizarPlano,
} from '../../planos.js';
import { Building2 } from 'lucide-react';
import { UnidadesPainel } from '../../components/UnidadesPainel.js';
import { listarUnidades, ListaUnidades } from '../../services/boomiiWalletService.js';

/**
 * Filiais de uma loja, vistas pelo administrador Boomii: mesmo painel do
 * lojista, com "Liberar (cobrar extra)" para as unidades aguardando e sem o
 * limite do plano (o admin amplia o contrato ao criar/ativar).
 */
const FiliaisDaLoja: React.FC<{
  loja: LojistaFirestoreData;
  onFechar: () => void;
  onToast: (msg: string) => void;
  onMudou: () => void;
}> = ({ loja, onFechar, onToast, onMudou }) => {
  const [lista, setLista] = useState<ListaUnidades | null>(null);
  const [carregando, setCarregando] = useState(true);
  // onToast muda a cada render do pai; pela ref, um erro mostrado não dispara
  // um novo carregamento (que falharia e mostraria o erro de novo, em ciclo).
  const avisar = React.useRef(onToast);
  avisar.current = onToast;
  const recarregar = React.useCallback(async () => {
    setCarregando(true);
    const res = await listarUnidades(loja.id);
    setCarregando(false);
    if (res.sucesso) setLista(res);
    else avisar.current(res.erro);
  }, [loja.id]);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm overflow-y-auto p-4 sm:p-8" onClick={onFechar}>
      <div className="mx-auto max-w-5xl rounded-3xl border border-border bg-background p-5 sm:p-8 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="label-eyebrow">Administração Boomii</span>
            <h2 className="text-xl font-bold text-foreground truncate">Filiais de {loja.nome}</h2>
          </div>
          <button
            type="button"
            onClick={onFechar}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {normalizarPlano(loja.financeiro?.plano) !== 'completo' && (
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-400">
            Esta loja está no plano {NOME_PLANO[normalizarPlano(loja.financeiro?.plano)]}: filiais extras ficam inativas
            até ela passar para o Completo.
          </p>
        )}
        <UnidadesPainel
          lojaId={loja.id}
          lista={lista}
          carregando={carregando}
          onMudou={() => {
            recarregar();
            onMudou();
          }}
          onToast={onToast}
          modoAdmin
        />
      </div>
    </div>
  );
};

interface AdminContasProps {
  onNavigate: (tab: SiteNavTab) => void;
  onSelectStore: (slug: string) => void;
  onLogout: () => void;
}

export const AdminContas: React.FC<AdminContasProps> = ({
  onNavigate,
  onSelectStore,
  onLogout,
}) => {
  const [lojistas, setLojistas] = useState<LojistaFirestoreData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'adimplente' | 'inadimplente'>('todos');
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [activeEditingId, setActiveEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    id: '',
    nome: '',
    email: '',
    senha: '',
    plano: 'pro',
    statusFinanceiro: 'adimplente' as 'adimplente' | 'inadimplente',
    premio: 'Recompensa Exclusiva (10º Selo)',
    corFundo: '#121215',
    unidadesContratadas: 1,
  });
  const [isSaving, setIsSaving] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const carregarLojistas = async () => {
    setLoading(true);
    try {
      const data = await listarTodosLojistas();
      setLojistas(data);
    } catch (err: any) {
      showToast(`Erro ao carregar lojistas: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarLojistas();
  }, []);

  const togglePasswordVisibility = (id: string) => {
    setVisiblePasswords((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleOpenCreate = () => {
    setModalMode('create');
    setActiveEditingId(null);
    setFormData({
      id: '',
      nome: '',
      email: '',
      senha: '',
      plano: 'pro',
      statusFinanceiro: 'adimplente',
      premio: 'Recompensa Exclusiva (10º Selo)',
      corFundo: '#121215',
      unidadesContratadas: 1,
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (lojista: LojistaFirestoreData) => {
    setModalMode('edit');
    setActiveEditingId(lojista.id);
    setFormData({
      id: lojista.id,
      nome: lojista.nome || '',
      email: lojista.email || '',
      senha: lojista.senha || '',
      plano: normalizarPlano(lojista.financeiro?.plano),
      statusFinanceiro: lojista.statusFinanceiro || 'adimplente',
      premio: lojista.layout?.premio || 'Recompensa Exclusiva (10º Selo)',
      corFundo: lojista.layout?.corFundo || '#121215',
      unidadesContratadas: Number((lojista.financeiro as any)?.unidadesContratadas) || 1,
    });
    setModalOpen(true);
  };

  const handleSaveLojista = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome.trim() || !formData.email.trim()) {
      showToast('Preencha o Nome e o E-mail da loja.');
      return;
    }

    const docId = modalMode === 'create'
      ? (formData.id.trim() || formData.nome.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-'))
      : activeEditingId!;

    setIsSaving(true);
    try {
      // A senha NÃO é gravada no Firestore: o acesso vive no Firebase Auth
      // (ver provisionarAcessoLojista logo abaixo). O documento do lojista tem
      // leitura pública — guardar senha aqui a expunha para qualquer visitante.
      const plano = normalizarPlano(formData.plano);
      const anterior = lojistas.find((l) => l.id === docId);
      const planoAnterior = anterior ? normalizarPlano(anterior.financeiro?.plano) : null;
      // Rebaixou para o Essencial: o visual premium continua por 30 dias, para
      // os clientes da loja não verem o cartão mudar de repente.
      const rebaixouVisual =
        plano === 'essencial' && planoAnterior !== null && planoAnterior !== 'essencial';

      await salvarLojistaFirestore(docId, {
        nome: formData.nome.trim(),
        email: formData.email.toLowerCase().trim(),
        ativo: true,
        statusFinanceiro: formData.statusFinanceiro,
        financeiro: {
          status: formData.statusFinanceiro,
          plano,
          // Só o Completo tem filiais; nos demais o contrato volta a 1 unidade.
          unidadesContratadas: plano === 'completo' ? Math.max(1, Number(formData.unidadesContratadas) || 1) : 1,
          valorMensal: mensalidadeDoPlano(plano, plano === 'completo' ? Number(formData.unidadesContratadas) || 1 : 1),
          bloqueadoPorInadimplencia: formData.statusFinanceiro === 'inadimplente',
          ...(rebaixouVisual ? { carenciaVisualAte: Date.now() + 30 * 24 * 60 * 60 * 1000 } : {}),
        } as any,
        // Visual e regras de fábrica só na CRIAÇÃO. Antes eram regravados a
        // cada edição: trocar o plano de uma loja apagava a logo, o prêmio e a
        // meta que o lojista tinha configurado.
        ...(modalMode === 'create'
          ? {
              layout: {
                corFundo: formData.corFundo || '#121215',
                corTexto: '#FFFFFF',
                heroUrl: 'https://boomii-fidelidade.web.app/boomii-hero.jpg',
                logoUrl: 'https://boomii-fidelidade.web.app/boomii-logo.jpg',
                nomePrograma: 'Programa de Fidelidade Digital',
                premio: formData.premio || 'Recompensa Exclusiva (10º Selo)',
                validadeDias: 30,
              },
              regras: {
                meta: 10,
                intervaloMinimoMin: 30,
                maxSelosDiaPorCliente: 2,
                validadeDias: 180,
                exigirSMS: false,
              },
            }
          : {}),
      } as any);

      // Cria/atualiza a conta de acesso no Firebase Auth com as claims da loja.
      // Ao editar sem informar senha, a senha atual é preservada.
      const acesso = await provisionarAcessoLojista(
        formData.email,
        formData.senha,
        docId
      );

      if (!acesso.sucesso) {
        showToast(
          `Dados salvos, mas o acesso não pôde ser criado: ${acesso.erro}. O lojista ainda não conseguirá entrar.`
        );
      } else {
        showToast(
          modalMode === 'create'
            ? `Lojista "${formData.nome}" cadastrado e acesso liberado!`
            : `Dados de "${formData.nome}" atualizados com sucesso!`
        );
      }
      setModalOpen(false);
      await carregarLojistas();
    } catch (err: any) {
      showToast(`Erro ao salvar no Firestore: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (lojista: LojistaFirestoreData) => {
    const novoStatus = lojista.statusFinanceiro === 'adimplente' ? 'inadimplente' : 'adimplente';
    try {
      await alternarStatusFinanceiroLojista(lojista.id, novoStatus);
      showToast(
        novoStatus === 'adimplente'
          ? `✅ "${lojista.nome}" liberado (Adimplente)!`
          : `⚠️ "${lojista.nome}" bloqueado por inadimplência.`
      );
      setLojistas((prev) =>
        prev.map((l) =>
          l.id === lojista.id
            ? {
                ...l,
                statusFinanceiro: novoStatus,
                financeiro: l.financeiro
                  ? { ...l.financeiro, status: novoStatus, bloqueadoPorInadimplencia: novoStatus === 'inadimplente' }
                  : undefined,
              }
            : l
        )
      );
    } catch (err: any) {
      showToast(`Erro ao alterar status: ${err.message}`);
    }
  };

  const handleDeleteLojista = async (id: string, nome: string) => {
    if (!window.confirm(`Tem certeza que deseja remover o lojista "${nome}" (${id}) do Firestore?`)) {
      return;
    }
    try {
      await excluirLojistaFirestore(id);
      showToast(`Lojista "${nome}" removido do Firestore.`);
      setLojistas((prev) => prev.filter((l) => l.id !== id));
    } catch (err: any) {
      showToast(`Erro ao excluir: ${err.message}`);
    }
  };

  const handleImpersonate = (slug: string) => {
    localStorage.setItem('boomii_active_lojista', slug);
    onSelectStore(slug);
    onNavigate('painel');
  };

  const handleCopyLink = (slug: string) => {
    const url = urlCadastroCliente(slug);
    navigator.clipboard.writeText(url);
    showToast(`Link copiado: ${url}`);
  };

  const lojistasFiltrados = lojistas.filter((l) => {
    const matchesSearch =
      l.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.slug?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === 'todos' || l.statusFinanceiro === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalAtivos = lojistas.filter((l) => l.statusFinanceiro === 'adimplente').length;
  const totalInadimplentes = lojistas.filter((l) => l.statusFinanceiro === 'inadimplente').length;

  // Faturamento: mensalidade de cada loja adimplente (plano + unidades extras).
  const mensalidadeDe = (l: LojistaFirestoreData) =>
    mensalidadeDoPlano(normalizarPlano(l.financeiro?.plano), Number((l.financeiro as any)?.unidadesContratadas) || 1);
  const faturamentoMensal = lojistas
    .filter((l) => l.statusFinanceiro !== 'inadimplente')
    .reduce((soma, l) => soma + mensalidadeDe(l), 0);
  const lojasPorPlano = ORDEM_PLANOS.map((p) => ({
    plano: p,
    total: lojistas.filter((l) => normalizarPlano(l.financeiro?.plano) === p).length,
  }));
  const unidadesAguardando = lojistas.reduce((s, l) => s + (Number(l.unidadesResumo?.aguardando) || 0), 0);
  const [lojaFiliais, setLojaFiliais] = useState<LojistaFirestoreData | null>(null);

  return (
    <div className="min-h-screen bg-[#0A0A0C] text-[#EDEDED] font-sans antialiased flex flex-col">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-3 bg-[#18181B] border border-primary/50 px-4 py-3 rounded-xl shadow-2xl animate-fade-in text-sm text-foreground">
          <Sparkles className="w-4 h-4 text-primary" />
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="text-muted-foreground hover:text-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── TOPBAR DO MASTER ADMIN ── */}
      <header className="sticky top-0 z-40 border-b border-border/40 bg-[#0F0F12]/95 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-amber-500 text-black flex items-center justify-center font-black shadow-lg">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-foreground tracking-tight text-base">
                  BOOMII Fidelidade
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-primary/20 text-primary border border-primary/30">
                  Master Superadmin
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Painel de Controle Central • Administrador Geral
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-secondary/40 border border-border/40 text-xs">
              <UserCheck className="w-3.5 h-3.5 text-primary" />
              <span className="text-foreground font-medium">Adriane Bezerra</span>
              <span className="text-muted-foreground">({MASTER_ADMIN_EMAIL})</span>
            </div>

            <button
              type="button"
              onClick={carregarLojistas}
              disabled={loading}
              title="Atualizar lista do Firestore"
              className="p-2 rounded-xl bg-secondary/40 hover:bg-secondary border border-border/40 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-primary' : ''}`} />
            </button>

            <button
              type="button"
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── CONTEÚDO PRINCIPAL ── */}
      <main className="flex-1 mx-auto max-w-7xl w-full px-4 sm:px-6 py-8 space-y-8">
        {/* Banner de Boas-vindas & Indicadores */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="surface-panel p-5 rounded-2xl border border-border/60 relative overflow-hidden">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
              Lojistas Cadastrados
            </div>
            <div className="text-3xl font-black text-foreground">
              {lojistas.length}
            </div>
            <span className="text-xs text-primary font-medium mt-1 block">
              Base Firestore /lojistas
            </span>
          </div>

          <div className="surface-panel p-5 rounded-2xl border border-border/60 relative overflow-hidden">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
              Lojas Ativas & Adimplentes
            </div>
            <div className="text-3xl font-black text-emerald-400">
              {totalAtivos}
            </div>
            <span className="text-xs text-emerald-500/80 font-medium mt-1 block">
              Balcão e Passes liberados
            </span>
          </div>

          <div className="surface-panel p-5 rounded-2xl border border-border/60 relative overflow-hidden">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
              Lojas Inadimplentes
            </div>
            <div className="text-3xl font-black text-rose-400">
              {totalInadimplentes}
            </div>
            <span className="text-xs text-rose-500/80 font-medium mt-1 block">
              Acesso e carimbos suspensos
            </span>
          </div>

          <div className="surface-panel p-5 rounded-2xl border border-border/60 relative overflow-hidden">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
              Faturamento mensal
            </div>
            <div className="text-3xl font-black text-primary tabular-nums">
              {faturamentoMensal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
            </div>
            <span className="text-xs text-muted-foreground mt-1 block">
              Lojas adimplentes, com unidades extras
            </span>
          </div>
        </div>

        {/* Planos e filiais: quantas lojas em cada plano e o que espera liberação. */}
        <div className="surface-panel rounded-2xl border border-border/60 px-5 py-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
          {lojasPorPlano.map(({ plano, total }) => (
            <span key={plano} className="text-muted-foreground">
              <strong className="text-foreground">{NOME_PLANO[plano]}</strong> ({PRECO_PLANO[plano].toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}):{' '}
              <strong className="text-foreground tabular-nums">{total}</strong> {total === 1 ? 'loja' : 'lojas'}
            </span>
          ))}
          <span className={`ml-auto font-semibold ${unidadesAguardando ? 'text-amber-400' : 'text-muted-foreground'}`}>
            {unidadesAguardando
              ? `${unidadesAguardando} ${unidadesAguardando === 1 ? 'filial aguardando' : 'filiais aguardando'} sua liberação`
              : 'Nenhuma filial aguardando liberação'}
          </span>
        </div>

        {/* ── BARRA DE CONTROLE & AÇÕES ── */}
        <div className="surface-panel p-5 rounded-2xl border border-border/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por Nome, Slug ou E-mail..."
                className="w-full rounded-xl border border-input bg-background pl-10 pr-4 py-2.5 text-sm text-foreground outline-none focus:border-primary transition-colors"
              />
            </div>

            {/* Filter by status */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-background border border-input">
              <button
                type="button"
                onClick={() => setStatusFilter('todos')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  statusFilter === 'todos' ? 'bg-primary text-black' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Todos ({lojistas.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('adimplente')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  statusFilter === 'adimplente' ? 'bg-emerald-500 text-black' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Ativos ({totalAtivos})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('inadimplente')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  statusFilter === 'inadimplente' ? 'bg-rose-500 text-white' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Inadimplentes ({totalInadimplentes})
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="btn-boomii py-2.5 px-5 text-sm font-bold flex items-center justify-center gap-2 cursor-pointer shadow-xl shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Cadastrar Novo Lojista</span>
          </button>
        </div>

        {/* ── TABELA DE LOJISTAS & CREDENCIAIS ── */}
        <div className="surface-panel rounded-2xl border border-border/60 overflow-hidden shadow-2xl">
          <div className="p-5 border-b border-border/40 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <Store className="w-5 h-5 text-primary" />
                <span>Gestão de Lojistas e Senhas de Acesso</span>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Altere e-mails, senhas, planos e status financeiro de qualquer loja diretamente no Firestore.
              </p>
            </div>
            <span className="text-xs text-muted-foreground">
              Exibindo <strong>{lojistasFiltrados.length}</strong> de {lojistas.length} lojas
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-primary animate-spin mx-auto" />
              <p className="text-sm text-muted-foreground">Conectando e consultando Firestore...</p>
            </div>
          ) : lojistasFiltrados.length === 0 ? (
            <div className="p-12 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-secondary/60 text-muted-foreground flex items-center justify-center mx-auto">
                <Store className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-foreground">Nenhum lojista encontrado</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  {searchTerm ? 'Nenhuma loja corresponde à sua pesquisa.' : 'Cadastre sua primeira loja para começar os testes.'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleOpenCreate}
                className="btn-boomii py-2 px-4 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Cadastrar Lojista Agora</span>
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-secondary/30 border-b border-border/40 text-muted-foreground font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3.5 px-4">Loja / Marca</th>
                    <th className="py-3.5 px-4">ID Firestore (Slug)</th>
                    <th className="py-3.5 px-4">E-mail de Login</th>
                    <th className="py-3.5 px-4">Unidades</th>
                    <th className="py-3.5 px-4">Plano</th>
                    <th className="py-3.5 px-4">Status Financeiro</th>
                    <th className="py-3.5 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {lojistasFiltrados.map((lojista) => {
                    const isPassVisible = visiblePasswords[lojista.id] || false;
                    const isAdimplente = lojista.statusFinanceiro === 'adimplente';

                    return (
                      <tr key={lojista.id} className="hover:bg-secondary/20 transition-colors">
                        {/* Marca */}
                        <td className="py-4 px-4 font-bold text-foreground">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-xl bg-secondary/80 border border-border/60 flex items-center justify-center font-black text-primary text-sm shrink-0">
                              {lojista.nome.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="text-sm font-bold text-foreground">
                                {lojista.nome}
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                {lojista.layout?.nomePrograma || 'Programa de Fidelidade'}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* ID Documento */}
                        <td className="py-4 px-4">
                          <div className="inline-flex items-center gap-1.5 font-mono text-[11px] bg-background px-2 py-1 rounded border border-border/50 text-foreground">
                            <span>{lojista.slug || lojista.id}</span>
                            <button
                              type="button"
                              onClick={() => handleCopyLink(lojista.slug || lojista.id)}
                              title="Copiar link do cliente (/c/:slug)"
                              className="text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        </td>

                        {/* E-mail de Login */}
                        <td className="py-4 px-4 font-medium text-foreground">
                          <div className="flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <span className="truncate max-w-[200px]" title={lojista.email}>
                              {lojista.email || <span className="text-muted-foreground italic">Não informado</span>}
                            </span>
                          </div>
                        </td>

                        {/* Unidades (filiais) */}
                        <td className="py-4 px-4 text-xs">
                          {(() => {
                            const resumo = lojista.unidadesResumo;
                            const contratadas = Number((lojista.financeiro as any)?.unidadesContratadas) || 1;
                            const ativas = Number(resumo?.ativas) || 1;
                            const aguardando = Number(resumo?.aguardando) || 0;
                            return (
                              <button
                                type="button"
                                onClick={() => setLojaFiliais(lojista)}
                                className="inline-flex flex-col items-start gap-0.5 cursor-pointer hover:text-primary"
                                title="Ver e gerenciar as unidades desta loja"
                              >
                                <span className="font-bold text-foreground tabular-nums">
                                  {ativas}/{contratadas} {contratadas === 1 ? 'contratada' : 'contratadas'}
                                </span>
                                {aguardando > 0 && (
                                  <span className="text-[10px] font-bold text-amber-400">{aguardando} aguardando liberação</span>
                                )}
                              </button>
                            );
                          })()}
                        </td>

                        {/* Plano e mensalidade */}
                        <td className="py-4 px-4">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-secondary text-foreground border border-border/50">
                            {NOME_PLANO[normalizarPlano(lojista.financeiro?.plano)]}
                          </span>
                          <span className="block text-[11px] text-muted-foreground mt-1 tabular-nums">
                            {mensalidadeDe(lojista).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}/mês
                          </span>
                        </td>
                        {/* Status Financeiro */}
                        <td className="py-4 px-4">
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(lojista)}
                            title={isAdimplente ? 'Clique para bloquear por inadimplência' : 'Clique para liberar'}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold cursor-pointer transition-all ${
                              isAdimplente
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20'
                            }`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${isAdimplente ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                            <span>{isAdimplente ? 'Adimplente' : 'Inadimplente'}</span>
                          </button>
                        </td>

                        {/* Ações */}
                        <td className="py-4 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {/* Impersonar / Acessar Painel */}
                            <button
                              type="button"
                              onClick={() => handleImpersonate(lojista.slug || lojista.id)}
                              className="px-2.5 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                              title="Acessar o painel como este lojista"
                            >
                              <span>Acessar Painel</span>
                              <ChevronRight className="w-3 h-3" />
                            </button>

                            {/* Filiais */}
                            <button
                              type="button"
                              onClick={() => setLojaFiliais(lojista)}
                              className="p-1.5 rounded-lg bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                              title="Unidades e filiais"
                            >
                              <Building2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Editar */}
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(lojista)}
                              className="p-1.5 rounded-lg bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                              title="Editar dados e senha"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            {/* Excluir */}
                            <button
                              type="button"
                              onClick={() => handleDeleteLojista(lojista.id, lojista.nome)}
                              className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors cursor-pointer"
                              title="Excluir lojista"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* ── FILIAIS DE UMA LOJA ── */}
      {lojaFiliais && (
        <FiliaisDaLoja
          loja={lojaFiliais}
          onFechar={() => setLojaFiliais(null)}
          onToast={showToast}
          onMudou={carregarLojistas}
        />
      )}

      {/* ── MODAL CADASTRO / EDIÇÃO DE LOJISTA ── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="surface-panel w-full max-w-lg p-6 rounded-2xl border border-primary/40 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-border/40">
              <div className="flex items-center gap-2">
                <Store className="w-5 h-5 text-primary" />
                <h3 className="text-base font-bold text-foreground">
                  {modalMode === 'create' ? 'Cadastrar Novo Lojista' : `Editar Lojista: ${formData.nome}`}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveLojista} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label-eyebrow block mb-1.5">Nome da Loja *</label>
                  <input
                    type="text"
                    required
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    placeholder="Ex: Nox Dessert Club"
                    className="w-full rounded-xl border border-input bg-background px-4 py-2 text-sm text-foreground outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="label-eyebrow block mb-1.5">ID do Documento (Slug) *</label>
                  <input
                    type="text"
                    required
                    disabled={modalMode === 'edit'}
                    value={formData.id}
                    onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                    placeholder="Ex: nox-dessert-club"
                    className="w-full rounded-xl border border-input bg-background px-4 py-2 text-sm text-foreground outline-none focus:border-primary disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label-eyebrow block mb-1.5">E-mail de Login *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="lojista@empresa.com"
                    className="w-full rounded-xl border border-input bg-background px-4 py-2 text-sm text-foreground outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="label-eyebrow block mb-1.5">Senha de Acesso *</label>
                  <input
                    type="text"
                    required
                    value={formData.senha}
                    onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
                    placeholder="Ex: mimi#123456"
                    className="w-full rounded-xl border border-input bg-background px-4 py-2 text-sm text-foreground font-mono outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label-eyebrow block mb-1.5">Plano</label>
                  <select
                    value={formData.plano}
                    onChange={(e) => setFormData({ ...formData, plano: e.target.value })}
                    className="w-full rounded-xl border border-input bg-background px-4 py-2 text-sm text-foreground outline-none focus:border-primary cursor-pointer"
                  >
                    {ORDEM_PLANOS.map((p) => (
                      <option key={p} value={p}>
                        {NOME_PLANO[p]} (R$ {PRECO_PLANO[p]}/mês)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label-eyebrow block mb-1.5">Status Financeiro</label>
                  <select
                    value={formData.statusFinanceiro}
                    onChange={(e) => setFormData({ ...formData, statusFinanceiro: e.target.value as any })}
                    className="w-full rounded-xl border border-input bg-background px-4 py-2 text-sm text-foreground outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="adimplente">Adimplente (Liberado)</option>
                    <option value="inadimplente">Inadimplente (Bloqueado)</option>
                  </select>
                </div>
              </div>

              {/* Filiais: só no Completo. 1 unidade inclusa, cada extra soma à mensalidade. */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                {normalizarPlano(formData.plano) === 'completo' ? (
                  <div>
                    <label className="label-eyebrow block mb-1.5">Unidades contratadas</label>
                    <input
                      type="number"
                      min={1}
                      max={200}
                      value={formData.unidadesContratadas}
                      onChange={(e) =>
                        setFormData({ ...formData, unidadesContratadas: Math.max(1, Number(e.target.value) || 1) })
                      }
                      className="w-full rounded-xl border border-input bg-background px-4 py-2 text-sm text-foreground outline-none focus:border-primary"
                    />
                    <span className="text-[11px] text-muted-foreground mt-1 block">
                      1 inclusa · extra R$ {PRECO_UNIDADE_EXTRA}/mês cada
                    </span>
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    Filiais só no plano Completo. Neste plano a loja opera com 1 unidade.
                  </p>
                )}
                <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5">
                  <span className="text-[11px] text-muted-foreground block">Mensalidade</span>
                  <strong className="text-lg text-primary tabular-nums">
                    {mensalidadeDoPlano(
                      normalizarPlano(formData.plano),
                      normalizarPlano(formData.plano) === 'completo' ? formData.unidadesContratadas : 1
                    ).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </strong>
                </div>
              </div>

              <div>
                <label className="label-eyebrow block mb-1.5">Prêmio do 10º Selo</label>
                <input
                  type="text"
                  value={formData.premio}
                  onChange={(e) => setFormData({ ...formData, premio: e.target.value })}
                  placeholder="Ex: Sobremesa Especial da Casa (10º Selo)"
                  className="w-full rounded-xl border border-input bg-background px-4 py-2 text-sm text-foreground outline-none focus:border-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/40">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="btn-boomii py-2 px-5 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-lg"
                >
                  {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>{modalMode === 'create' ? 'Salvar no Firestore' : 'Atualizar Dados'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
