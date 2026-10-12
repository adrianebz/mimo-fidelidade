import React, { useEffect, useState } from 'react';
import { X, RefreshCw, AlertCircle, Download, ShieldAlert } from 'lucide-react';
import { exportarClientes } from '../services/boomiiWalletService.js';

interface Props {
  lojaId: string;
  totalClientes: number;
  onFechar: () => void;
  onConcluido: (total: number) => void;
}

type Periodo = 'tudo' | '30' | '90' | 'ano';

const OPCOES: Array<{ id: Periodo; rotulo: string }> = [
  { id: 'tudo', rotulo: 'Todo o histórico' },
  { id: '30', rotulo: 'Últimos 30 dias' },
  { id: '90', rotulo: 'Últimos 90 dias' },
  { id: 'ano', rotulo: 'Este ano' },
];

function inicioDoPeriodo(p: Periodo): number | undefined {
  const agora = Date.now();
  if (p === '30') return agora - 30 * 86400000;
  if (p === '90') return agora - 90 * 86400000;
  if (p === 'ano') return new Date(new Date().getFullYear(), 0, 1).getTime();
  return undefined;
}

/**
 * Entrega o arquivo. No navegador, download comum. No app (iPhone/Android),
 * o WebView não baixa arquivos: abre a folha de compartilhar do sistema, de
 * onde o lojista salva em Arquivos, manda por e-mail ou WhatsApp.
 */
async function entregarArquivo(csv: string, nome: string): Promise<void> {
  const arquivo = new File([csv], nome, { type: 'text/csv;charset=utf-8' });
  const nav = navigator as any;
  const ehApp = Boolean((window as any).Capacitor?.isNativePlatform?.());
  if (ehApp && nav.canShare?.({ files: [arquivo] })) {
    await nav.share({ files: [arquivo], title: nome });
    return;
  }
  const url = URL.createObjectURL(arquivo);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Planilha com as métricas de cada cliente (plano Completo). */
export const ExportarClientesModal: React.FC<Props> = ({ lojaId, totalClientes, onFechar, onConcluido }) => {
  const [periodo, setPeriodo] = useState<Periodo>('tudo');
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => e.key === 'Escape' && !gerando && onFechar();
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [onFechar, gerando]);

  const gerar = async () => {
    setErro(null);
    setGerando(true);
    const res = await exportarClientes(lojaId, { desde: inicioDoPeriodo(periodo) });
    if (!res.sucesso) {
      setGerando(false);
      setErro(res.erro);
      return;
    }
    try {
      await entregarArquivo(res.csv, res.nomeArquivo);
      onConcluido(res.total);
    } catch (e: any) {
      // Cancelar a folha de compartilhar não é erro.
      if (e?.name !== 'AbortError') setErro('A planilha foi gerada, mas não deu para salvar o arquivo. Tente de novo.');
    } finally {
      setGerando(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-background/80 backdrop-blur-sm p-0 sm:p-4 animate-fade-in"
      onClick={() => !gerando && onFechar()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-exportar"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-border bg-card shadow-2xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] space-y-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="titulo-exportar" className="text-lg font-bold text-foreground">
              Planilha de clientes
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Uma linha por cliente ({totalClientes}), com visitas, selos, recompensas, frequência e há quantos dias
              não aparece. Abre no Excel e no Google Planilhas.
            </p>
          </div>
          <button
            type="button"
            onClick={onFechar}
            disabled={gerando}
            aria-label="Fechar"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <fieldset className="space-y-2">
          <legend className="label-eyebrow mb-1.5">Período das visitas</legend>
          <div className="grid grid-cols-2 gap-2">
            {OPCOES.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setPeriodo(o.id)}
                aria-pressed={periodo === o.id}
                className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors cursor-pointer ${
                  periodo === o.id
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-foreground hover:bg-secondary'
                }`}
              >
                {o.rotulo}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            O período vale para visitas, selos e recompensas. Os demais dados são sempre os atuais.
          </p>
        </fieldset>

        <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] text-amber-600 dark:text-amber-300">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            O arquivo tem dados pessoais (nome, celular, e-mail). Guarde em lugar seguro e não compartilhe fora da
            loja — LGPD. Cada download fica registrado.
          </span>
        </div>

        {erro && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs font-medium flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{erro}</span>
          </div>
        )}

        <button
          type="button"
          onClick={gerar}
          disabled={gerando || totalClientes === 0}
          className="btn-boomii w-full py-3 text-sm font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
        >
          {gerando ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          <span>{gerando ? 'Gerando planilha...' : 'Baixar planilha'}</span>
        </button>
      </div>
    </div>
  );
};

export default ExportarClientesModal;
