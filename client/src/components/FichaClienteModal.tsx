import React, { useEffect, useState } from 'react';
import { X, RefreshCw, AlertCircle, Award, Gift, Cake, Smartphone, ShoppingBag } from 'lucide-react';
import { obterFichaCliente, MetricasCliente, EventoFicha } from '../services/boomiiWalletService.js';

interface Props {
  lojaId: string;
  cliente: { id: string; name: string; initials: string; avatarBg: string };
  onFechar: () => void;
}

function data(ms: number | null | undefined, comHora = false): string {
  if (!ms) return '—';
  const d = new Date(ms);
  const dia = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  return comHora ? `${dia}, ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : dia;
}

const Numero: React.FC<{ rotulo: string; valor: React.ReactNode; detalhe?: string; alerta?: boolean }> = ({
  rotulo,
  valor,
  detalhe,
  alerta,
}) => (
  <div className="rounded-xl border border-border/60 bg-background/50 p-3 min-w-0">
    <span className="text-[11px] text-muted-foreground block truncate">{rotulo}</span>
    <span className={`text-xl font-black tabular-nums ${alerta ? 'text-rose-500' : 'text-foreground'}`}>{valor}</span>
    {detalhe && <span className="text-[10px] text-muted-foreground block truncate">{detalhe}</span>}
  </div>
);

/** "Cookie Nutella ×2, Água ×1" — o que foi comprado (Itens Fixos). */
function listaItens(e: EventoFicha): string {
  return (e.itens || []).map((i) => `${i.nome} ×${i.qtd}`).join(', ');
}

function descreverEvento(e: EventoFicha): { Icone: React.ComponentType<{ className?: string }>; texto: string; cor: string } {
  if (e.tipo === 'venda') {
    return { Icone: ShoppingBag, texto: `Comprou ${listaItens(e) || 'itens'} (sem selo)`, cor: 'text-muted-foreground' };
  }
  if (e.tipo === 'resgate') {
    return { Icone: Gift, texto: `Resgatou ${e.premio || 'a recompensa'}${e.ciclo ? ` (${e.ciclo}º ciclo)` : ''}`, cor: 'text-emerald-500' };
  }
  if (e.tipo === 'bonus_aniversario') {
    return { Icone: Cake, texto: `Presente de aniversário: +${e.selos ?? 0} ${e.selos === 1 ? 'selo' : 'selos'}`, cor: 'text-primary' };
  }
  const qtd = e.selos ?? 1;
  const comprou = listaItens(e);
  return {
    Icone: Award,
    texto: `+${qtd} ${qtd === 1 ? 'selo' : 'selos'}${e.saldo !== undefined ? ` · saldo ${e.saldo}` : ''}${comprou ? ` · ${comprou}` : ''}`,
    cor: 'text-primary',
  };
}

/**
 * Ficha do cliente (plano Pro+): como ele se comporta — frequência, quanto
 * tempo sumido, recompensas — e a linha do tempo de cada visita.
 */
export const FichaClienteModal: React.FC<Props> = ({ lojaId, cliente, onFechar }) => {
  const [estado, setEstado] = useState<
    | { tipo: 'carregando' }
    | { tipo: 'erro'; mensagem: string }
    | { tipo: 'ok'; m: MetricasCliente; eventos: EventoFicha[] }
  >({ tipo: 'carregando' });

  useEffect(() => {
    let ativo = true;
    obterFichaCliente(lojaId, cliente.id).then((res) => {
      if (!ativo) return;
      setEstado(res.sucesso ? { tipo: 'ok', m: res.metricas, eventos: res.linhaDoTempo } : { tipo: 'erro', mensagem: res.erro });
    });
    const aoTeclar = (e: KeyboardEvent) => e.key === 'Escape' && onFechar();
    window.addEventListener('keydown', aoTeclar);
    return () => {
      ativo = false;
      window.removeEventListener('keydown', aoTeclar);
    };
  }, [lojaId, cliente.id, onFechar]);

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-background/80 backdrop-blur-sm p-0 sm:p-4 animate-fade-in"
      onClick={onFechar}
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-ficha-cliente"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg max-h-[92vh] flex flex-col rounded-t-3xl sm:rounded-3xl border border-border bg-card shadow-2xl"
      >
        <div className="flex items-center gap-3 p-5 pb-3 border-b border-border/40">
          <div className={`h-11 w-11 shrink-0 rounded-full flex items-center justify-center font-bold text-sm ${cliente.avatarBg}`}>
            {cliente.initials}
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="titulo-ficha-cliente" className="text-lg font-bold text-foreground truncate">
              {cliente.name}
            </h2>
            {estado.tipo === 'ok' && (
              <p className="text-xs text-muted-foreground truncate">
                Cliente desde {data(estado.m.cadastradoEm)}
                {estado.m.appleWallet && (
                  <span className="inline-flex items-center gap-0.5 ml-1.5">
                    · <Smartphone className="w-3 h-3" /> Apple Wallet
                  </span>
                )}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] space-y-5">
          {estado.tipo === 'carregando' && (
            <div className="py-10 flex flex-col items-center gap-2 text-muted-foreground">
              <RefreshCw className="w-6 h-6 animate-spin text-primary" />
              <span className="text-xs font-semibold">Carregando a ficha...</span>
            </div>
          )}

          {estado.tipo === 'erro' && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs font-medium flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{estado.mensagem}</span>
            </div>
          )}

          {estado.tipo === 'ok' && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <Numero rotulo="Selos agora" valor={`${estado.m.selosAtuais}/${estado.m.meta}`} detalhe={`${estado.m.cicloAtual}º ciclo`} />
                <Numero rotulo="Visitas" valor={estado.m.visitas} detalhe={`${estado.m.selosGanhos} selos ganhos`} />
                <Numero rotulo="Recompensas" valor={estado.m.resgates} detalhe="resgatadas" />
                <Numero
                  rotulo="Volta a cada"
                  valor={estado.m.frequenciaMediaDias !== null ? `${estado.m.frequenciaMediaDias}d` : '—'}
                  detalhe="em média"
                />
                <Numero
                  rotulo="Sem aparecer"
                  valor={estado.m.diasSemAparecer !== null ? `${estado.m.diasSemAparecer}d` : '—'}
                  detalhe={`última: ${data(estado.m.ultimaVisita)}`}
                  alerta={
                    estado.m.diasSemAparecer !== null &&
                    estado.m.frequenciaMediaDias !== null &&
                    estado.m.diasSemAparecer > Math.max(14, estado.m.frequenciaMediaDias * 2)
                  }
                />
                <Numero rotulo="Primeira visita" valor={data(estado.m.primeiraVisita)} />
              </div>

              {estado.m.produtoFavorito && (
                <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5 text-sm">
                  <ShoppingBag className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-muted-foreground">Produto favorito:</span>
                  <strong className="text-foreground truncate">{estado.m.produtoFavorito}</strong>
                </div>
              )}

              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Histórico</h3>
                {estado.eventos.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">Nenhuma visita registrada ainda.</p>
                ) : (
                  <ol className="relative border-l border-border/60 ml-2 space-y-3">
                    {estado.eventos.map((e, i) => {
                      const { Icone, texto, cor } = descreverEvento(e);
                      return (
                        <li key={i} className="ml-4">
                          <span className="absolute -left-[9px] flex h-[18px] w-[18px] items-center justify-center rounded-full bg-card border border-border">
                            <Icone className={`h-2.5 w-2.5 ${cor}`} />
                          </span>
                          <p className="text-sm text-foreground">{texto}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {data(e.em, true)}
                            {e.unidade && ` · em ${e.unidade}`}
                            {e.operador && ` · por ${e.operador}`}
                          </p>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default FichaClienteModal;
