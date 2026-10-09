import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { X, RefreshCw, AlertCircle, Copy, Check, MessageCircle, Share2 } from 'lucide-react';
import { gerarLinkReenvio } from '../services/boomiiWalletService.js';
import { urlReenvioCartao } from '../siteConfig.js';

interface Props {
  lojaId: string;
  lojaNome: string;
  cliente: { id: string; name: string; phone: string };
  onFechar: () => void;
}

/**
 * Reenvio do cartão para o cliente que trocou de celular.
 *
 * Gera um link de uso exclusivo (válido por alguns dias) que abre o MESMO
 * cartão para "Adicionar à carteira" — sem emitir cartão novo nem perder
 * selos. O lojista manda pelo WhatsApp, copia, ou mostra o QR no balcão.
 */
export const ReenviarCartaoModal: React.FC<Props> = ({ lojaId, lojaNome, cliente, onFechar }) => {
  const [estado, setEstado] = useState<
    | { tipo: 'gerando' }
    | { tipo: 'erro'; mensagem: string }
    | { tipo: 'pronto'; url: string; qr: string; dias: number }
  >({ tipo: 'gerando' });
  const [copiado, setCopiado] = useState(false);

  const gerar = async () => {
    setEstado({ tipo: 'gerando' });
    const res = await gerarLinkReenvio(lojaId, cliente.id);
    if (!res.sucesso || !res.token) {
      setEstado({ tipo: 'erro', mensagem: res.erro || 'Não foi possível gerar o link.' });
      return;
    }
    const url = urlReenvioCartao(res.token);
    const qr = await QRCode.toDataURL(url, { margin: 1, width: 360, color: { dark: '#000000', light: '#FFFFFF' } });
    setEstado({ tipo: 'pronto', url, qr, dias: res.dias || 7 });
  };

  useEffect(() => {
    gerar();
    const aoTeclar = (e: KeyboardEvent) => e.key === 'Escape' && onFechar();
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const primeiroNome = cliente.name.trim().split(/\s+/)[0] || '';
  const mensagem = (url: string) =>
    `Olá${primeiroNome ? `, ${primeiroNome}` : ''}! Aqui está o link para adicionar de novo o seu cartão fidelidade da ${lojaNome} à carteira do celular. Os seus selos continuam os mesmos: ${url}`;

  const celularDigitos = (cliente.phone || '').replace(/\D/g, '');

  const copiar = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      window.prompt('Copie o link:', url);
    }
  };

  const podeCompartilhar = typeof navigator !== 'undefined' && typeof (navigator as any).share === 'function';

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-background/80 backdrop-blur-sm p-0 sm:p-4 animate-fade-in"
      onClick={onFechar}
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-reenviar-cartao"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-border bg-card shadow-2xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] space-y-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="titulo-reenviar-cartao" className="text-lg font-bold text-foreground">
              Reenviar cartão
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Para <strong className="text-foreground">{cliente.name}</strong> adicionar o mesmo cartão em outro
              celular. Os selos são mantidos.
            </p>
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

        {estado.tipo === 'gerando' && (
          <div className="py-10 flex flex-col items-center gap-2 text-muted-foreground">
            <RefreshCw className="w-6 h-6 animate-spin text-primary" />
            <span className="text-xs font-semibold">Gerando o link...</span>
          </div>
        )}

        {estado.tipo === 'erro' && (
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs font-medium flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{estado.mensagem}</span>
            </div>
            <button
              type="button"
              onClick={gerar}
              className="w-full rounded-xl border border-border py-2.5 text-sm font-semibold text-foreground hover:bg-secondary transition-colors cursor-pointer"
            >
              Tentar de novo
            </button>
          </div>
        )}

        {estado.tipo === 'pronto' && (
          <div className="space-y-4">
            {/* No balcão: o cliente aponta a câmera do celular novo. */}
            <div className="flex flex-col items-center gap-2">
              <img
                src={estado.qr}
                alt="QR Code do link para adicionar o cartão"
                className="w-44 h-44 rounded-2xl bg-white p-2"
              />
              <span className="text-[11px] text-muted-foreground text-center">
                No balcão: peça para o cliente apontar a câmera do celular novo.
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {celularDigitos.length >= 10 && (
                <a
                  href={`https://wa.me/${celularDigitos}?text=${encodeURIComponent(mensagem(estado.url))}`}
                  target="_blank"
                  rel="noreferrer"
                  className="col-span-2 btn-boomii py-2.5 text-sm font-bold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Enviar pelo WhatsApp</span>
                </a>
              )}
              <button
                type="button"
                onClick={() => copiar(estado.url)}
                className={`${podeCompartilhar ? '' : 'col-span-2 '}rounded-xl border border-border py-2.5 text-sm font-semibold text-foreground hover:bg-secondary transition-colors flex items-center justify-center gap-2 cursor-pointer`}
              >
                {copiado ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                <span>{copiado ? 'Copiado' : 'Copiar link'}</span>
              </button>
              {podeCompartilhar && (
                <button
                  type="button"
                  onClick={() =>
                    (navigator as any).share({ title: `Cartão ${lojaNome}`, text: mensagem(estado.url) }).catch(() => {})
                  }
                  className="rounded-xl border border-border py-2.5 text-sm font-semibold text-foreground hover:bg-secondary transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Compartilhar</span>
                </button>
              )}
            </div>

            <p className="text-[11px] text-muted-foreground text-center">
              O link vale por {estado.dias} dias e só abre o cartão deste cliente.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReenviarCartaoModal;
