import React, { useState } from 'react';
import { 
  Megaphone, Star, Cake, ClipboardCheck, ChevronRight, 
  Send, Sparkles, CheckCircle2, Clock, Users, ArrowUpRight, 
  MessageSquare, ThumbsUp, Plus, Calendar
} from 'lucide-react';

interface EngagementPagesProps {
  type: 'campanhas' | 'avaliacoes' | 'aniversarios' | 'pesquisas';
}

export const EngagementPages: React.FC<EngagementPagesProps> = ({ type }) => {
  const [notificationTitle, setNotificationTitle] = useState('Festival de Sobremesas!');
  const [notificationBody, setNotificationBody] = useState('Ganhe selo em dobro em todas as compras hoje no NOX Dessert Club.');
  const [targetCohort, setTargetCohort] = useState('all');
  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);

  const handleSendPush = async () => {
    setIsSending(true);
    await new Promise(r => setTimeout(r, 600));
    setIsSending(false);
    setSendSuccess(true);
    setTimeout(() => setSendSuccess(false), 4000);
  };

  // 1. CAMPANHAS
  if (type === 'campanhas') {
    return (
      <div className="space-y-6 animate-fade-in-up">
        <div className="border-b border-slate-200/80 pb-4">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium mb-1">
            <span>Início</span>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-slate-700 font-semibold">Campanhas Push</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Notificações Push na Carteira
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Envie mensagens instantâneas para a tela de bloqueio de quem tem seu cartão na Apple Wallet e Google Wallet.
          </p>
        </div>

        {sendSuccess && (
          <div className="bg-emerald-50 border border-emerald-300 p-4 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Notificação push enviada para 30 cartões ativos!</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 saas-card p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-teal-600" />
              <span>Nova Campanha Push</span>
            </h3>

            <div>
              <label className="text-xs font-bold uppercase text-slate-600 block mb-1">
                Público Alvo
              </label>
              <select
                value={targetCohort}
                onChange={(e) => setTargetCohort(e.target.value)}
                className="input-saas font-semibold"
              >
                <option value="all">Todos os Clientes (30 cartões)</option>
                <option value="ausente">Clientes Ausentes (2 cartões - Sem visita há 14d)</option>
                <option value="habitual">Clientes Habituais (1 cartão)</option>
                <option value="novo">Novos Clientes (6 cartões)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold uppercase text-slate-600 block mb-1">
                Título da Mensagem
              </label>
              <input
                type="text"
                value={notificationTitle}
                onChange={(e) => setNotificationTitle(e.target.value)}
                className="input-saas font-semibold"
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase text-slate-600 block mb-1">
                Texto da Notificação
              </label>
              <textarea
                value={notificationBody}
                onChange={(e) => setNotificationBody(e.target.value)}
                rows={3}
                className="input-saas text-xs leading-relaxed resize-none"
              />
            </div>

            <button
              type="button"
              onClick={handleSendPush}
              disabled={isSending}
              className="btn-primary-teal text-xs font-bold w-full py-3"
            >
              <Send className="w-4 h-4" />
              <span>{isSending ? 'Disparando...' : 'Enviar Push Agora'}</span>
            </button>
          </div>

          <div className="lg:col-span-5 saas-card p-6 space-y-4">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              Simulador da Tela de Bloqueio
            </span>

            {/* iOS Lock Screen Notification Simulator */}
            <div className="bg-slate-900 rounded-3xl p-5 text-white shadow-xl space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                <span>9:41</span>
                <span>5G 100%</span>
              </div>

              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 space-y-1.5 shadow-lg">
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5 font-bold text-white">
                    <span className="w-4 h-4 rounded bg-teal-500 flex items-center justify-center text-[10px]">
                      FC
                    </span>
                    <span>CARTEIRA • AGORA</span>
                  </div>
                </div>
                <h4 className="text-xs font-bold text-white leading-tight">
                  {notificationTitle}
                </h4>
                <p className="text-[11px] text-slate-300 leading-snug">
                  {notificationBody}
                </p>
              </div>

              <div className="text-center text-[10px] text-slate-500 pt-2">
                O cliente toca na notificação e o cartão abre automaticamente.
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. AVALIAÇÕES GOOGLE
  if (type === 'avaliacoes') {
    return (
      <div className="space-y-6 animate-fade-in-up">
        <div className="border-b border-slate-200/80 pb-4">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium mb-1">
            <span>Início</span>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-slate-700 font-semibold">Avaliações Google</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Booster de Avaliações Google Maps
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Solicite 5 estrelas no Google automaticamente após o cliente resgatar a recompensa no balcão.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="saas-card p-5">
            <span className="text-xs font-bold text-slate-400 uppercase block">Nota Atual no Google</span>
            <div className="text-3xl font-black text-amber-500 mt-1 flex items-center gap-2">
              <span>4.9</span>
              <div className="flex text-amber-400 text-sm">★★★★★</div>
            </div>
            <span className="text-xs text-slate-500 mt-1 block">Baseado em 142 avaliações</span>
          </div>

          <div className="saas-card p-5">
            <span className="text-xs font-bold text-slate-400 uppercase block">Convites de Avaliação</span>
            <div className="text-3xl font-black text-slate-900 mt-1">19</div>
            <span className="text-xs text-emerald-600 mt-1 block font-semibold">+8 avaliações geradas este mês</span>
          </div>

          <div className="saas-card p-5">
            <span className="text-xs font-bold text-slate-400 uppercase block">Taxa de Conversão</span>
            <div className="text-3xl font-black text-teal-600 mt-1">42%</div>
            <span className="text-xs text-slate-500 mt-1 block">Muito acima da média de varejo</span>
          </div>
        </div>

        <div className="saas-card p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-900">
            Link Direto de Avaliação Google
          </h3>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value="https://g.page/r/nox-dessert-club/review"
              className="input-saas font-mono text-xs bg-slate-50"
            />
            <button
              type="button"
              onClick={() => alert('Link copiado para a área de transferência!')}
              className="btn-primary-teal text-xs whitespace-nowrap px-4"
            >
              Copiar Link
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. ANIVERSÁRIOS
  if (type === 'aniversarios') {
    return (
      <div className="space-y-6 animate-fade-in-up">
        <div className="border-b border-slate-200/80 pb-4">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium mb-1">
            <span>Início</span>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-slate-700 font-semibold">Aniversários</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Automação de Aniversariantes
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Presenteie seus clientes no mês de aniversário com selos bônus ou sobremesa especial.
          </p>
        </div>

        <div className="saas-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-pink-50 text-pink-600 flex items-center justify-center">
                <Cake className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Regra Ativa: Presente de Aniversário</h3>
                <p className="text-xs text-slate-500">1 Selo Bônus + Fatia de Torta no dia do aniversário</p>
              </div>
            </div>
            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full text-xs font-bold">
              Ativo
            </span>
          </div>

          <div className="pt-4 border-t border-slate-100 space-y-3">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Aniversariantes deste Mês (Setembro)
            </h4>
            <div className="divide-y divide-slate-100 text-xs">
              <div className="py-2.5 flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-900">Camila Albuquerque</p>
                  <p className="text-[11px] text-slate-500">Aniversário em 18 de Setembro</p>
                </div>
                <span className="text-pink-600 font-bold bg-pink-50 px-2 py-0.5 rounded-full text-[10px]">
                  Cupom Agendado
                </span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-900">Gabriel Souza</p>
                  <p className="text-[11px] text-slate-500">Aniversário em 24 de Setembro</p>
                </div>
                <span className="text-pink-600 font-bold bg-pink-50 px-2 py-0.5 rounded-full text-[10px]">
                  Cupom Agendado
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 4. PESQUISAS (NPS)
  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="border-b border-slate-200/80 pb-4">
        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium mb-1">
          <span>Início</span>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-slate-700 font-semibold">Pesquisas & NPS</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
          Pesquisas de Satisfação dos Clientes
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="saas-card p-6 space-y-4">
          <span className="text-xs font-bold text-slate-400 uppercase block">NPS Global da Loja</span>
          <div className="text-4xl font-black text-emerald-600">+88</div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Zona de Excelência. 94% dos seus clientes recomendariam o <strong>NOX Dessert Club</strong> para amigos e colegas.
          </p>
        </div>

        <div className="saas-card p-6 space-y-3">
          <span className="text-xs font-bold text-slate-400 uppercase block">Último Feedback Recebido</span>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800">Maria Silva</span>
              <span className="text-amber-500 font-bold">10/10 ★</span>
            </div>
            <p className="text-slate-600 italic text-[11px]">
              "Amo não precisar baixar app nenhum! O cartão fica direto na minha carteira do iPhone e carimbam em 2 segundos no caixa."
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
