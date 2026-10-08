import React, { useEffect, useRef, useState } from 'react';
import { X, Lock, RefreshCw, AlertCircle, Trash2, AlertTriangle } from 'lucide-react';
import {
  editarCliente,
  excluirCliente,
  ResultadoEdicaoCliente,
  ResultadoExclusaoCliente,
} from '../services/boomiiWalletService.js';

export interface ClienteEditavel {
  id: string;
  name: string;
  email: string;
  phone: string;
  /** Como está gravado: "AAAA-MM-DD", "MM-DD" ou vazio. */
  birthdayRaw: string;
}

interface Props {
  lojaId: string;
  cliente: ClienteEditavel;
  onFechar: () => void;
  onSalvo: (clienteId: string, resultado: ResultadoEdicaoCliente) => void;
  onExcluido: (clienteId: string, resultado: ResultadoExclusaoCliente) => void;
}

/** "AAAA-MM-DD" | "MM-DD" → "DD/MM/AAAA" | "DD/MM", para exibir no campo. */
function paraCampo(raw: string): string {
  const v = (raw || '').trim();
  let m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  m = v.match(/^(\d{2})-(\d{2})$/);
  if (m) return `${m[2]}/${m[1]}`;
  return '';
}

/**
 * "DD/MM" | "DD/MM/AAAA" → formato gravado. `null` se inválido, '' se vazio.
 * A validação de verdade (dia existente, data no passado) é refeita no servidor.
 */
function paraGravar(campo: string): string | null {
  const v = campo.trim();
  if (!v) return '';
  const m = v.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/);
  if (!m) return null;
  const dd = m[1].padStart(2, '0');
  const mm = m[2].padStart(2, '0');
  return m[3] ? `${m[3]}-${mm}-${dd}` : `${mm}-${dd}`;
}

/** Máscara leve: só dígitos e barras, no formato DD/MM/AAAA. */
function mascarar(texto: string): string {
  const d = texto.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

function formatarCelular(e164: string): string {
  const m = (e164 || '').match(/^\+?55(\d{2})(\d{4,5})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164 || '—';
}

export const EditarClienteModal: React.FC<Props> = ({ lojaId, cliente, onFechar, onSalvo, onExcluido }) => {
  const [nome, setNome] = useState(cliente.name);
  const [email, setEmail] = useState(cliente.email);
  const [aniversario, setAniversario] = useState(paraCampo(cliente.birthdayRaw));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const primeiroCampo = useRef<HTMLInputElement>(null);
  const botaoVoltar = useRef<HTMLButtonElement>(null);

  // Na confirmação, o foco vai para "Voltar": um Enter distraído não exclui ninguém.
  useEffect(() => {
    if (confirmandoExclusao) botaoVoltar.current?.focus();
    else primeiroCampo.current?.focus();
  }, [confirmandoExclusao]);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || salvando) return;
      if (confirmandoExclusao) setConfirmandoExclusao(false);
      else onFechar();
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [onFechar, salvando, confirmandoExclusao]);

  const excluir = async () => {
    setErro(null);
    setSalvando(true);
    const res = await excluirCliente(lojaId, cliente.id);
    setSalvando(false);
    if (!res.sucesso) {
      setErro(res.erro || 'Não foi possível excluir.');
      return;
    }
    onExcluido(cliente.id, res);
  };

  const alterado =
    nome.trim() !== cliente.name ||
    email.trim().toLowerCase() !== cliente.email ||
    aniversario !== paraCampo(cliente.birthdayRaw);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (nome.trim().length < 2) {
      setErro('Informe o nome do cliente.');
      return;
    }
    const aniv = paraGravar(aniversario);
    if (aniv === null) {
      setErro('Aniversário no formato DD/MM ou DD/MM/AAAA.');
      return;
    }

    setSalvando(true);
    const res = await editarCliente(lojaId, cliente.id, {
      nome: nome.trim(),
      email: email.trim().toLowerCase(),
      aniversario: aniv,
    });
    setSalvando(false);

    if (!res.sucesso) {
      setErro(res.erro || 'Não foi possível salvar.');
      return;
    }
    onSalvo(cliente.id, res);
  };

  const campo =
    'w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-primary transition-colors disabled:opacity-60';

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-background/80 backdrop-blur-sm p-0 sm:p-4 animate-fade-in"
      onClick={() => !salvando && onFechar()}
      role="dialog"
      aria-modal="true"
      aria-labelledby={confirmandoExclusao ? 'titulo-excluir-cliente' : 'titulo-editar-cliente'}
    >
      {confirmandoExclusao ? (
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-border bg-card shadow-2xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] space-y-4"
        >
          <div className="h-12 w-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h2 id="titulo-excluir-cliente" className="text-lg font-bold text-foreground">
              Tem certeza que deseja excluir {cliente.name}?
            </h2>
            <p className="text-sm text-muted-foreground">
              O cadastro e os selos acumulados serão apagados, e o cartão deixará de valer na carteira do
              cliente. <strong className="text-foreground">Essa ação não pode ser desfeita.</strong>
            </p>
          </div>

          {erro && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs font-medium flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{erro}</span>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              ref={botaoVoltar}
              type="button"
              onClick={() => {
                setErro(null);
                setConfirmandoExclusao(false);
              }}
              disabled={salvando}
              className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold text-foreground hover:bg-secondary transition-colors cursor-pointer disabled:opacity-50"
            >
              Voltar
            </button>
            <button
              type="button"
              onClick={excluir}
              disabled={salvando}
              className="flex-1 rounded-xl bg-rose-600 hover:bg-rose-700 py-2.5 text-sm font-bold text-white flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {salvando ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Excluindo...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  <span>Sim, excluir</span>
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
      <form
        onSubmit={salvar}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-border bg-card shadow-2xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] space-y-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="titulo-editar-cliente" className="text-lg font-bold text-foreground">
              Editar cliente
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              As alterações também atualizam o cartão na carteira do cliente.
            </p>
          </div>
          <button
            type="button"
            onClick={onFechar}
            disabled={salvando}
            aria-label="Fechar"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {erro && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs font-medium flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{erro}</span>
          </div>
        )}

        <div className="space-y-3">
          <label className="block">
            <span className="label-eyebrow block mb-1.5">Nome</span>
            <input
              ref={primeiroCampo}
              type="text"
              required
              maxLength={80}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              disabled={salvando}
              className={campo}
              autoComplete="off"
            />
          </label>

          <label className="block">
            <span className="label-eyebrow block mb-1.5">E-mail</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={salvando}
              className={campo}
              autoComplete="off"
            />
          </label>

          <label className="block">
            <span className="label-eyebrow block mb-1.5">Aniversário</span>
            <input
              type="text"
              inputMode="numeric"
              placeholder="DD/MM ou DD/MM/AAAA"
              value={aniversario}
              onChange={(e) => setAniversario(mascarar(e.target.value))}
              disabled={salvando}
              className={campo}
              autoComplete="off"
            />
            <span className="text-[11px] text-muted-foreground mt-1 block">
              O ano é opcional. Deixe em branco para remover.
            </span>
          </label>

          <div>
            <span className="label-eyebrow block mb-1.5">Celular</span>
            <div className="flex items-center gap-2 rounded-xl border border-border bg-secondary/50 px-3.5 py-2.5 text-sm text-muted-foreground">
              <Lock className="w-3.5 h-3.5 shrink-0" />
              <span>{formatarCelular(cliente.phone)}</span>
            </div>
            <span className="text-[11px] text-muted-foreground mt-1 block">
              O celular identifica o cartão do cliente e não pode ser alterado.
            </span>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onFechar}
            disabled={salvando}
            className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold text-foreground hover:bg-secondary transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={salvando || !alterado}
            className="btn-boomii flex-1 py-2.5 text-sm font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {salvando ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Salvando...</span>
              </>
            ) : (
              <span>Salvar</span>
            )}
          </button>
        </div>

        <div className="border-t border-border/60 pt-3 flex justify-center">
          <button
            type="button"
            onClick={() => {
              setErro(null);
              setConfirmandoExclusao(true);
            }}
            disabled={salvando}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Excluir cliente</span>
          </button>
        </div>
      </form>
      )}
    </div>
  );
};

export default EditarClienteModal;
