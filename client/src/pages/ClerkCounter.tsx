import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import confetti from 'canvas-confetti';
import { 
  QrCode, UserPlus, CheckCircle2, AlertCircle, 
  RotateCcw, Sparkles, Clock, Search, Gift,
  Smartphone, Share2, Copy, ArrowRight, RefreshCw,
  ExternalLink
} from 'lucide-react';
import { PassPreview } from '../components/PassPreview.js';
import * as mock from '../services/mockData.js';

export const ClerkCounter: React.FC = () => {
  const [serialInput, setSerialInput] = useState('8f3a-92bc-41de-aa22');
  const [currentCard, setCurrentCard] = useState<mock.CardData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStamping, setIsStamping] = useState(false);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Invite modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [currentInvite, setCurrentInvite] = useState<mock.InviteData | null>(null);
  const [inviteQrDataUrl, setInviteQrDataUrl] = useState<string>('');
  const [inviteTimeLeft, setInviteTimeLeft] = useState(900);
  const [copiedLink, setCopiedLink] = useState(false);

  // Customer search & Reissue state
  const [showReissueModal, setShowReissueModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [reissueResult, setReissueResult] = useState<any | null>(null);

  const loadCard = async (serial: string) => {
    if (!serial.trim()) return;
    setIsLoading(true);
    setFeedback(null);
    try {
      const data = await mock.fetchCard(serial);
      setCurrentCard(data);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
      setCurrentCard(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCard(serialInput);
  }, []);

  const handleStamp = async () => {
    if (!currentCard || isStamping) return;
    setIsStamping(true);
    setFeedback(null);
    const startTime = performance.now();

    try {
      const result = await mock.stampCard(currentCard.serial);
      const elapsedSec = ((performance.now() - startTime) / 1000).toFixed(2);

      if (result.stamps >= 10) {
        confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 } });
        setFeedback({
          type: 'success',
          message: `🎉 10º SELO REGISTRADO EM ${elapsedSec}s! Recompensa liberada para resgate!`
        });
      } else {
        setFeedback({
          type: 'success',
          message: `✅ Selo registrado com sucesso em ${elapsedSec}s! Novo saldo: ${result.stamps}/10`
        });
      }

      await loadCard(currentCard.serial);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setIsStamping(false);
    }
  };

  const handleRedeem = async () => {
    if (!currentCard || isRedeeming) return;
    setIsRedeeming(true);
    try {
      const result = await mock.redeemReward(currentCard.serial);
      confetti({ particleCount: 140, spread: 90, origin: { y: 0.5 } });
      setFeedback({
        type: 'success',
        message: `🎁 Recompensa (${result.rewardRedeemed}) entregue! Ciclo #${result.newCycle} iniciado.`
      });
      await loadCard(currentCard.serial);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setIsRedeeming(false);
    }
  };

  const handleGenerateInvite = async () => {
    try {
      const data = await mock.generateInvite();
      setCurrentInvite(data);
      setInviteTimeLeft(900);
      const url = await QRCode.toDataURL(data.qr_payload, {
        width: 260,
        margin: 2,
        color: { dark: '#0F172A', light: '#FFFFFF' }
      });
      setInviteQrDataUrl(url);
      setShowInviteModal(true);
    } catch (err) {
      alert('Erro ao gerar convite.');
    }
  };

  const handleCopyLink = () => {
    if (!currentInvite) return;
    navigator.clipboard.writeText(currentInvite.qr_payload);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  const handleSearchCustomer = async () => {
    if (!searchQuery.trim()) return;
    const res = await mock.findCustomerForReissue(searchQuery);
    setReissueResult(res);
  };

  // Quick preset cards
  const demoCardsList = [
    { serial: '8f3a-92bc-41de-aa22', name: 'Maria Silva (8 selos)' },
    { serial: 'b2c4-11ef-99ab-de34', name: 'João Santos (3 selos)' },
    { serial: 'f7e1-45cd-8a32-bc56', name: 'Ana Costa (10 selos - Recompensa!)' },
  ];

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
        <div>
          <span className="text-[11px] font-bold tracking-wider text-teal-600 uppercase block mb-1">
            TERMINAL DE ATENDIMENTO
          </span>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Balcão & Caixa PWA
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Carimbe o cartão do cliente em 1 toque ou gere convite QR para novo cadastro.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleGenerateInvite}
            className="btn-primary-teal text-xs font-bold py-2.5 px-4 shadow-sm"
          >
            <UserPlus className="w-4 h-4" />
            <span>Emitir Convite QR</span>
          </button>
          <button
            type="button"
            onClick={() => setShowReissueModal(true)}
            className="btn-outline-subtle text-xs py-2.5 px-3"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reemitir Cartão</span>
          </button>
        </div>
      </div>

      {/* Main Cashier Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Search, Stamping & Confirmation */}
        <div className="lg:col-span-7 space-y-5">
          {/* Card Serial Lookup */}
          <div className="saas-card p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <QrCode className="w-4 h-4 text-teal-600" />
              <span>Identificar Cartão do Cliente</span>
            </h3>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={serialInput}
                  onChange={(e) => setSerialInput(e.target.value)}
                  placeholder="Cole o serial do cliente ou escaneie o QR..."
                  className="input-saas font-mono text-xs sm:text-sm"
                  onKeyDown={(e) => e.key === 'Enter' && loadCard(serialInput)}
                />
              </div>
              <button
                type="button"
                onClick={() => loadCard(serialInput)}
                disabled={isLoading}
                className="btn-primary-teal text-xs px-4"
              >
                {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Buscar'}
              </button>
            </div>

            {/* Quick Suggestions */}
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                Exemplos Rápidos de Demonstração:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {demoCardsList.map((item) => (
                  <button
                    key={item.serial}
                    type="button"
                    onClick={() => {
                      setSerialInput(item.serial);
                      loadCard(item.serial);
                    }}
                    className={`text-[11px] px-2.5 py-1 rounded-lg font-semibold border transition-colors ${
                      serialInput === item.serial
                        ? 'bg-teal-50 border-teal-300 text-teal-800'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Feedback message */}
          {feedback && (
            <div
              className={`p-4 rounded-xl border text-xs font-bold flex items-center gap-2.5 animate-fade-in ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : 'bg-rose-50 border-rose-300 text-rose-900'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              )}
              <span className="leading-relaxed">{feedback.message}</span>
            </div>
          )}

          {/* Current Card Operations Box */}
          {currentCard && (
            <div className="saas-card p-6 space-y-6">
              {/* Header inside card */}
              <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                <div>
                  <span className="text-[10px] font-bold text-teal-600 uppercase tracking-wider block mb-0.5">
                    CLIENTE IDENTIFICADO
                  </span>
                  <h2 className="text-xl font-black text-slate-900">
                    {currentCard.customer.name}
                  </h2>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    {currentCard.customer.email_masked} • Serial: {currentCard.serial}
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block font-mono">
                    SALDO ATUAL
                  </span>
                  <span className="text-2xl font-black text-teal-700 font-mono">
                    {currentCard.stamps} / {currentCard.required}
                  </span>
                  <span className="text-[11px] text-slate-500 block font-semibold">
                    Ciclo #{currentCard.cycle}
                  </span>
                </div>
              </div>

              {/* Stamp progress row */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>Progresso do Cartão</span>
                  <span>{currentCard.stamps >= 10 ? 'Recompensa Liberada!' : `${10 - currentCard.stamps} selos restantes`}</span>
                </div>
                <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      currentCard.stamps >= 10 ? 'bg-amber-400' : 'bg-teal-500'
                    }`}
                    style={{ width: `${(currentCard.stamps / 10) * 100}%` }}
                  />
                </div>
              </div>

              {/* Operational Action Buttons */}
              <div className="space-y-3 pt-2">
                {currentCard.reward_available ? (
                  /* Reward claim ready */
                  <button
                    type="button"
                    onClick={handleRedeem}
                    disabled={isRedeeming}
                    className="w-full py-4 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-sm shadow-md transition-all flex items-center justify-center gap-2"
                  >
                    <Gift className="w-5 h-5" />
                    <span>{isRedeeming ? 'Resgatando...' : `Entregar Recompensa (${currentCard.reward_label})`}</span>
                  </button>
                ) : (
                  /* Stamp card button */
                  <button
                    type="button"
                    onClick={handleStamp}
                    disabled={!currentCard.can_stamp || isStamping}
                    className="w-full py-4 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                  >
                    {isStamping ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <Sparkles className="w-5 h-5" />
                    )}
                    <span>
                      {currentCard.blocked_reason === 'STAMP_TOO_SOON'
                        ? `Aguarde proteção antiduplicação (${currentCard.seconds_remaining}s)`
                        : 'Carimbar +1 Selo no Cartão'}
                    </span>
                  </button>
                )}

                <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Proteção antiduplicação ativa (regra de 3 minutos). Resposta em ≤ 10ms.</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Live Pass Simulation */}
        <div className="lg:col-span-5 flex flex-col items-center">
          <div className="text-center mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Pass Ativo na Carteira
            </span>
          </div>

          {currentCard && (
            <PassPreview
              storeName="NOX Dessert Club"
              customerName={currentCard.customer.name}
              stamps={currentCard.stamps}
              rewardLabel={currentCard.reward_label}
              serial={currentCard.serial}
              cycle={currentCard.cycle}
            />
          )}
        </div>
      </div>

      {/* QR Invite Modal */}
      {showInviteModal && currentInvite && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Convite QR do Balcão</h3>
              <button 
                type="button" 
                onClick={() => setShowInviteModal(false)}
                className="text-slate-400 hover:text-slate-700 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Aponte a câmera do celular do cliente para escanear e salvar o cartão na carteira:
            </p>

            {inviteQrDataUrl && (
              <div className="p-4 bg-slate-50 rounded-2xl inline-block border border-slate-200 shadow-inner">
                <img src={inviteQrDataUrl} alt="QR Convite" className="w-52 h-52 mx-auto" />
              </div>
            )}

            <div className="flex items-center justify-center gap-1.5 text-xs text-amber-600 font-bold">
              <Clock className="w-3.5 h-3.5" />
              <span>Válido por 15 minutos (uso único)</span>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={handleCopyLink}
                className="btn-outline-subtle w-full text-xs py-2.5 font-semibold"
              >
                {copiedLink ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                <span>{copiedLink ? 'Link Copiado!' : 'Copiar Link de Convite'}</span>
              </button>
              
              <button
                type="button"
                onClick={() => {
                  const text = encodeURIComponent(`Adicione seu cartão de fidelidade do NOX Dessert Club: ${currentInvite.qr_payload}`);
                  window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
                }}
                className="btn-primary-teal w-full text-xs py-2.5 font-bold"
              >
                <Share2 className="w-4 h-4" />
                <span>Enviar pelo WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reissue Modal */}
      {showReissueModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-teal-600" />
                <h3 className="text-sm font-bold text-slate-900">Reemissão de Cartão</h3>
              </div>
              <button 
                type="button" 
                onClick={() => setShowReissueModal(false)}
                className="text-slate-400 hover:text-slate-700 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Se o cliente trocou de aparelho ou perdeu o acesso, busque pelo e-mail para reenviar o cartão mantendo o mesmo saldo e serial.
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Digite o e-mail ou nome..."
                className="input-saas text-xs"
              />
              <button
                type="button"
                onClick={handleSearchCustomer}
                className="btn-primary-teal text-xs px-3"
              >
                Localizar
              </button>
            </div>

            {reissueResult && (
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">{reissueResult.name}</span>
                  <span className="text-teal-700 font-bold">{reissueResult.stamps}/10 selos</span>
                </div>
                <p className="text-[11px] text-slate-500 font-mono">{reissueResult.email}</p>
                <button
                  type="button"
                  onClick={() => {
                    alert(`Novo link de instalação do cartão gerado e enviado para ${reissueResult.email}!`);
                    setShowReissueModal(false);
                  }}
                  className="btn-primary-teal w-full text-xs font-bold py-2 mt-2"
                >
                  Reenviar Cartão à Carteira
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
