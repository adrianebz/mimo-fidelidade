import React, { useEffect, useState } from 'react';
import { RefreshCw, AlertCircle, Smartphone } from 'lucide-react';
import { WalletBadges } from '../components/WalletBadges.js';
import { abrirLinkReenvio, CartaoReenviado } from '../services/boomiiWalletService.js';

/**
 * /r/{token}: o cliente que trocou de celular adiciona de novo o MESMO cartão
 * (mesmos selos, mesmo ciclo) à carteira. O link é gerado pelo lojista no
 * painel e vale alguns dias.
 */
export const ReenvioCartao: React.FC = () => {
  const token = window.location.pathname.split('/')[2] || '';
  const [estado, setEstado] = useState<
    { tipo: 'carregando' } | { tipo: 'erro'; mensagem: string } | { tipo: 'ok'; cartao: CartaoReenviado }
  >({ tipo: 'carregando' });

  useEffect(() => {
    let ativo = true;
    abrirLinkReenvio(token).then((res) => {
      if (!ativo) return;
      setEstado(res.sucesso ? { tipo: 'ok', cartao: res.cartao } : { tipo: 'erro', mensagem: res.erro });
    });
    return () => {
      ativo = false;
    };
  }, [token]);

  return (
    <div className="min-h-screen bg-[#0A0A0C] text-zinc-100 flex items-center justify-center px-4 py-10 pt-[max(2.5rem,env(safe-area-inset-top))] antialiased">
      <div className="w-full max-w-md">
        {estado.tipo === 'carregando' && (
          <div className="flex flex-col items-center gap-3 text-zinc-400">
            <RefreshCw className="w-7 h-7 animate-spin text-amber-400" />
            <span className="text-sm font-semibold">Buscando o seu cartão...</span>
          </div>
        )}

        {estado.tipo === 'erro' && (
          <div className="bg-[#141417] border border-zinc-800 rounded-3xl p-6 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
            <h1 className="text-lg font-bold text-white">Não deu para abrir o cartão</h1>
            <p className="text-sm text-zinc-400">{estado.mensagem}</p>
          </div>
        )}

        {estado.tipo === 'ok' && (
          <div className="bg-[#141417] border border-zinc-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
            <div className="text-center space-y-2">
              <div className="h-12 w-12 rounded-2xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center mx-auto">
                <Smartphone className="w-6 h-6 text-amber-400" />
              </div>
              <p className="text-xs font-bold uppercase tracking-wider text-amber-400">{estado.cartao.lojaNome}</p>
              <h1 className="text-2xl font-black text-white tracking-tight">
                {estado.cartao.primeiroNome ? `Olá, ${estado.cartao.primeiroNome}!` : 'Seu cartão fidelidade'}
              </h1>
              <p className="text-sm text-zinc-400">
                Adicione o seu cartão de novo à carteira deste celular. Os seus selos continuam os mesmos.
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-black/40 p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-400">Seus selos</span>
                <span className="font-bold text-white">
                  {estado.cartao.selos}/{estado.cartao.meta}
                </span>
              </div>
              <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-amber-400"
                  style={{ width: `${Math.min(100, (estado.cartao.selos / estado.cartao.meta) * 100)}%` }}
                />
              </div>
            </div>

            <WalletBadges applePassUrl={estado.cartao.applePassUrl} googleSaveUrl={estado.cartao.saveUrl} />

            <p className="text-[11px] text-zinc-500 text-center">
              Se o cartão antigo ainda estiver em outro aparelho, ele continua funcionando — é o mesmo cartão.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReenvioCartao;
