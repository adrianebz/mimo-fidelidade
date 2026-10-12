import React, { useState } from 'react';
import {
  Building2,
  Plus,
  MoreVertical,
  Edit3,
  Power,
  Trash2,
  UserPlus,
  UserMinus,
  Copy,
  X,
  RefreshCw,
  AlertCircle,
  Clock,
  MapPin,
  Check,
} from 'lucide-react';
import {
  ListaUnidades,
  Unidade,
  salvarUnidade,
  alterarStatusUnidade,
  convidarGerente,
  removerGerente,
  aprovarUnidade,
  excluirUnidade,
} from '../services/boomiiWalletService.js';
import { PRECO_UNIDADE_EXTRA } from '../planos.js';

interface Props {
  lojaId: string;
  lista: ListaUnidades | null;
  carregando: boolean;
  onMudou: () => void;
  onToast: (msg: string) => void;
  /** Painel do administrador Boomii: libera unidades aguardando e ignora o limite. */
  modoAdmin?: boolean;
}

const CAMPO =
  'w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-primary transition-colors';

const SELO_STATUS: Record<Unidade['status'], { texto: string; classe: string }> = {
  ativa: { texto: 'Ativa', classe: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' },
  inativa: { texto: 'Inativa', classe: 'bg-secondary text-muted-foreground border-border' },
  aguardando: { texto: 'Aguardando liberação', classe: 'bg-amber-500/10 text-amber-500 border-amber-500/30' },
};

/** Modal genérico do painel de unidades. */
const Janela: React.FC<{ titulo: string; onFechar: () => void; children: React.ReactNode }> = ({ titulo, onFechar, children }) => (
  <div
    className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-background/80 backdrop-blur-sm p-0 sm:p-4 animate-fade-in"
    onClick={onFechar}
    role="dialog"
    aria-modal="true"
  >
    <div
      onClick={(e) => e.stopPropagation()}
      className="w-full sm:max-w-md max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-border bg-card shadow-2xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] space-y-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-foreground">{titulo}</h2>
        <button
          type="button"
          onClick={onFechar}
          aria-label="Fechar"
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      {children}
    </div>
  </div>
);

const Erro: React.FC<{ texto: string | null }> = ({ texto }) =>
  texto ? (
    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs font-medium flex items-start gap-2">
      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
      <span>{texto}</span>
    </div>
  ) : null;

/**
 * Aba Unidades (plano Completo): filiais da marca, cada uma com link/QR de
 * cadastro próprio, gerente e contadores. Um cartão vale na rede toda.
 */
export const UnidadesPainel: React.FC<Props> = ({ lojaId, lista, carregando, onMudou, onToast, modoAdmin }) => {
  const [menuAberto, setMenuAberto] = useState<string | null>(null);
  const [formulario, setFormulario] = useState<{ unidade?: Unidade } | null>(null);
  const [convite, setConvite] = useState<Unidade | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const unidades = lista?.unidades || [];
  const ativas = unidades.filter((u) => u.status === 'ativa').length;
  const contratadas = lista?.contratadas || 1;
  // O lojista só cria/reativa dentro do que o admin liberou; o admin amplia o
  // contrato ao criar. O servidor recusa do mesmo jeito — aqui é para não
  // oferecer o que não vai funcionar.
  const limiteAtingido = !modoAdmin && ativas >= contratadas;

  const alternar = async (u: Unidade) => {
    setMenuAberto(null);
    setOcupado(true);
    const res = await alterarStatusUnidade(lojaId, u.id, u.status !== 'ativa');
    setOcupado(false);
    if (!res.sucesso) return onToast(res.erro);
    onToast(u.status === 'ativa' ? `${u.nome} desativada. O histórico continua guardado.` : `${u.nome} ativada.`);
    onMudou();
  };

  const liberar = async (u: Unidade) => {
    setMenuAberto(null);
    setOcupado(true);
    const res = await aprovarUnidade(lojaId, u.id);
    setOcupado(false);
    if (!res.sucesso) return onToast(res.erro);
    onToast(`${u.nome} liberada. Unidades contratadas: ${res.unidadesContratadas}.`);
    onMudou();
  };

  const apagar = async (u: Unidade) => {
    setMenuAberto(null);
    const aviso =
      `Excluir a unidade ${u.nome}?\n\n` +
      '• Os selos já dados nela continuam no histórico dos clientes.\n' +
      (u.gerenteEmail ? `• O gerente ${u.gerenteEmail} perde o acesso na hora.\n` : '') +
      '• Esta ação não pode ser desfeita.';
    if (!window.confirm(aviso)) return;
    setOcupado(true);
    const res = await excluirUnidade(lojaId, u.id);
    setOcupado(false);
    if (!res.sucesso) return onToast(res.erro);
    onToast(`Unidade ${u.nome} excluída.`);
    onMudou();
  };

  const tirarGerente = async (u: Unidade) => {
    setMenuAberto(null);
    if (!window.confirm(`Remover ${u.gerenteEmail} como gerente de ${u.nome}? O acesso dele é cortado na hora.`)) return;
    const res = await removerGerente(lojaId, u.id);
    if (!res.sucesso) return onToast(res.erro);
    onToast('Gerente removido.');
    onMudou();
  };


  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <span className="label-eyebrow">Rede</span>
          <h1 className="text-3xl font-black text-foreground tracking-tight mt-1">Unidades</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Um cartão para a rede toda: o cliente acumula e resgata em qualquer unidade.
          </p>
        </div>
        {!limiteAtingido && (
          <button
            type="button"
            onClick={() => setFormulario({})}
            className="btn-boomii shrink-0 px-5 py-3 text-sm font-bold flex items-center justify-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nova unidade</span>
          </button>
        )}
      </div>

      <div
        className={`rounded-2xl border px-4 py-3 text-xs flex flex-wrap items-center gap-x-4 gap-y-1 ${
          limiteAtingido ? 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-300' : 'border-border/60 bg-card text-muted-foreground'
        }`}
      >
        <span>
          <strong className="text-foreground">{ativas}</strong> de <strong className="text-foreground">{contratadas}</strong>{' '}
          {contratadas === 1 ? 'unidade contratada' : 'unidades contratadas'} em uso
        </span>
        <span>
          {limiteAtingido
            ? `Limite atingido. Para abrir mais uma unidade (+ R$ ${PRECO_UNIDADE_EXTRA}/mês), fale com a equipe Boomii.`
            : `Unidade extra: + R$ ${PRECO_UNIDADE_EXTRA}/mês, liberada pela equipe Boomii`}
        </span>
      </div>

      {carregando && !lista ? (
        <div className="py-12 flex justify-center">
          <RefreshCw className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {unidades.map((u) => {
            const selo = SELO_STATUS[u.status];
            return (
              <article key={u.id} className="relative rounded-2xl border border-border/60 bg-card p-4 space-y-3 min-w-0">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 shrink-0 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
                    <Building2 className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-foreground truncate">{u.nome}</h3>
                      {u.principal && <span className="text-[10px] font-bold text-primary">PRINCIPAL</span>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                      <MapPin className="w-3 h-3 shrink-0" />
                      {[u.endereco, u.cidade].filter(Boolean).join(' · ') || 'Endereço não informado'}
                    </p>
                  </div>
                  <div className="relative shrink-0 -mr-1.5 -mt-1">
                    <button
                      type="button"
                      onClick={() => setMenuAberto((id) => (id === u.id ? null : u.id))}
                      aria-label={`Opções de ${u.nome}`}
                      disabled={ocupado}
                      className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {menuAberto === u.id && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setMenuAberto(null)} />
                        <div role="menu" className="absolute right-0 top-9 z-50 w-52 rounded-xl border border-border bg-popover p-1 shadow-2xl">
                          {[
                            {
                              Icone: Check,
                              texto: 'Liberar (cobrar extra)',
                              acao: () => liberar(u),
                              oculto: !modoAdmin || u.status !== 'aguardando',
                            },
                            { Icone: Edit3, texto: 'Editar dados', acao: () => { setMenuAberto(null); setFormulario({ unidade: u }); } },
                            u.gerenteEmail
                              ? { Icone: UserMinus, texto: 'Remover gerente', acao: () => tirarGerente(u) }
                              : { Icone: UserPlus, texto: 'Convidar gerente', acao: () => { setMenuAberto(null); setConvite(u); }, oculto: u.status !== 'ativa' },
                            {
                              Icone: Power,
                              texto: u.status === 'ativa' ? 'Desativar' : 'Ativar',
                              acao: () => alternar(u),
                              // Reativar com o limite cheio não é possível para o lojista.
                              oculto: u.principal || u.status === 'aguardando' || (u.status !== 'ativa' && limiteAtingido),
                            },
                            { Icone: Trash2, texto: 'Excluir unidade', acao: () => apagar(u), oculto: u.principal },
                          ]
                            .filter((i) => !i.oculto)
                            .map(({ Icone, texto, acao }) => (
                              <button
                                key={texto}
                                type="button"
                                role="menuitem"
                                onClick={acao}
                                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-foreground hover:bg-secondary transition-colors cursor-pointer"
                              >
                                <Icone className="w-4 h-4 text-muted-foreground" />
                                <span>{texto}</span>
                              </button>
                            ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl bg-background/50 border border-border/50 px-3 py-2">
                    <span className="text-muted-foreground block">Selos dados no mês</span>
                    <strong className="text-foreground text-base tabular-nums">{u.carimbosMes}</strong>
                  </div>
                  <div className="rounded-xl bg-background/50 border border-border/50 px-3 py-2">
                    <span className="text-muted-foreground block">Mês anterior</span>
                    <strong className="text-foreground text-base tabular-nums">{u.carimbosMesAnterior}</strong>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className={`rounded-full border px-2 py-0.5 font-semibold ${selo.classe}`}>
                    {u.status === 'aguardando' && <Clock className="inline w-3 h-3 mr-1 -mt-px" />}
                    {selo.texto}
                    {u.status === 'inativa' && u.motivoInativa === 'plano' && ' (plano)'}
                  </span>
                  <span className="text-muted-foreground truncate">
                    {u.gerenteEmail ? `Gerente: ${u.gerenteEmail}` : 'Sem gerente'}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {formulario && (
        <FormularioUnidade
          lojaId={lojaId}
          unidade={formulario.unidade}
          onFechar={() => setFormulario(null)}
          onSalvo={(status) => {
            setFormulario(null);
            onToast(
              status === 'aguardando'
                ? `Unidade criada e aguardando liberação: ela passa do limite contratado (+ R$ ${PRECO_UNIDADE_EXTRA}/mês). A equipe Boomii foi avisada.`
                : 'Unidade salva.'
            );
            onMudou();
          }}
        />
      )}

      {convite && (
        <ConviteGerente
          lojaId={lojaId}
          unidade={convite}
          onFechar={() => setConvite(null)}
          onConvidado={() => onMudou()}
        />
      )}

    </div>
  );
};

const FormularioUnidade: React.FC<{
  lojaId: string;
  unidade?: Unidade;
  onFechar: () => void;
  onSalvo: (status?: Unidade['status']) => void;
}> = ({ lojaId, unidade, onFechar, onSalvo }) => {
  const [dados, setDados] = useState({
    nome: unidade?.nome || '',
    endereco: unidade?.endereco || '',
    cidade: unidade?.cidade || '',
    whatsapp: unidade?.whatsapp || '',
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    const res = await salvarUnidade(lojaId, dados, unidade?.id);
    setSalvando(false);
    if (!res.sucesso) return setErro(res.erro);
    onSalvo(res.status);
  };

  return (
    <Janela titulo={unidade ? `Editar ${unidade.nome}` : 'Nova unidade'} onFechar={onFechar}>
      <form onSubmit={salvar} className="space-y-3">
        <Erro texto={erro} />
        {[
          { chave: 'nome', rotulo: 'Nome da unidade', dica: 'Ex.: Pinheiros, Shopping Boulevard', obrigatorio: true },
          { chave: 'endereco', rotulo: 'Endereço', dica: 'Rua, número, bairro' },
          { chave: 'cidade', rotulo: 'Cidade', dica: 'Ex.: Belém - PA' },
          { chave: 'whatsapp', rotulo: 'WhatsApp da unidade', dica: '(91) 99999-9999' },
        ].map(({ chave, rotulo, dica, obrigatorio }) => (
          <label key={chave} className="block">
            <span className="label-eyebrow block mb-1.5">{rotulo}</span>
            <input
              className={CAMPO}
              value={(dados as any)[chave]}
              onChange={(e) => setDados((d) => ({ ...d, [chave]: e.target.value }))}
              placeholder={dica}
              required={obrigatorio}
              inputMode={chave === 'whatsapp' ? 'tel' : undefined}
              disabled={salvando}
            />
          </label>
        ))}
        <button
          type="submit"
          disabled={salvando || dados.nome.trim().length < 2}
          className="btn-boomii w-full py-3 text-sm font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
        >
          {salvando ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {salvando ? 'Salvando...' : 'Salvar'}
        </button>
      </form>
    </Janela>
  );
};

const ConviteGerente: React.FC<{ lojaId: string; unidade: Unidade; onFechar: () => void; onConvidado: () => void }> = ({
  lojaId,
  unidade,
  onFechar,
  onConvidado,
}) => {
  const [email, setEmail] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [link, setLink] = useState<string | null | undefined>(undefined);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    const res = await convidarGerente(lojaId, unidade.id, email);
    setEnviando(false);
    if (!res.sucesso) return setErro(res.erro);
    setLink(res.link);
    onConvidado();
  };

  return (
    <Janela titulo={`Gerente de ${unidade.nome}`} onFechar={onFechar}>
      {link === undefined ? (
        <form onSubmit={enviar} className="space-y-3">
          <p className="text-xs text-muted-foreground">
            O gerente entra no mesmo app com o perfil desta unidade: lê o QR, busca o cliente e dá ou resgata selos.
            Ele não vê os dados da conta principal — indicadores, lista de clientes com contatos, configurações nem a
            planilha.
          </p>
          <Erro texto={erro} />
          <label className="block">
            <span className="label-eyebrow block mb-1.5">E-mail do gerente</span>
            <input
              type="email"
              required
              className={CAMPO}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="gerente@exemplo.com"
              disabled={enviando}
              autoComplete="off"
            />
          </label>
          <button
            type="submit"
            disabled={enviando}
            className="btn-boomii w-full py-3 text-sm font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
          >
            {enviando ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            {enviando ? 'Convidando...' : 'Convidar'}
          </button>
        </form>
      ) : (
        <div className="space-y-3">
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
            Convite enviado para <strong>{email}</strong>. Ele recebe um e-mail para criar a senha e depois entra em
            boomii.com.br/arealojista ou no app.
          </div>
          {link && (
            <>
              <p className="text-xs text-muted-foreground">Se o e-mail não chegar, mande este link pelo WhatsApp:</p>
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(link)}
                className="w-full rounded-xl border border-border py-2.5 text-sm font-semibold text-foreground hover:bg-secondary transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Copy className="w-4 h-4" />
                Copiar link para criar a senha
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onFechar}
            className="w-full rounded-xl border border-border py-2.5 text-sm font-semibold text-foreground hover:bg-secondary transition-colors cursor-pointer"
          >
            Concluir
          </button>
        </div>
      )}
    </Janela>
  );
};

export default UnidadesPainel;
