import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import QRCode from 'qrcode';
import {
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Gift,
  Calendar,
  Phone,
  Mail,
  User,
  Clock,
  ExternalLink,
  ChevronLeft,
  Smartphone
} from 'lucide-react';
import { GoogleWalletBadge } from '../components/GoogleWalletBadge.js';
import {
  obterDadosLojista,
  cadastrarClienteECartao,
  gerarCodigoTotpAtual,
  formatarCelularDisplay,
  EnrolledCardResult
} from '../services/mimoWalletService.js';
import { SeedMerchantData } from '../data/seedData.js';

interface CustomerEnrollSlugProps {
  slugProp?: string;
  onBackToSite?: () => void;
}

export const CustomerEnrollSlug: React.FC<CustomerEnrollSlugProps> = ({ slugProp, onBackToSite }) => {
  // Extrai o slug da URL: /c/{slug}
  const currentPath = window.location.pathname;
  const pathSlug = currentPath.startsWith('/c/') ? currentPath.split('/c/')[1]?.split('/')[0] : '';
  const activeSlug = slugProp || pathSlug || 'minha-loja';

  const [merchant, setMerchant] = useState<SeedMerchantData | null>(null);
  const [loadingMerchant, setLoadingMerchant] = useState(true);

  // Form State
  const [nome, setNome] = useState('');
  const [celular, setCelular] = useState('');
  const [email, setEmail] = useState('');
  const [aniversario, setAniversario] = useState('');
  const [consentimento, setConsentimento] = useState(true);

  // SMS Verification State (quando ativado nas regras da loja)
  const [smsStep, setSmsStep] = useState(false);
  const [smsCode, setSmsCode] = useState('');

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [enrolledResult, setEnrolledResult] = useState<EnrolledCardResult | null>(null);

  // QR Code rotativo em tempo real
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [totpSecondsLeft, setTotpSecondsLeft] = useState<number>(30);
  const [totpCode, setTotpCode] = useState<string>('000000');

  // Carrega dados da loja
  useEffect(() => {
    async function loadStore() {
      setLoadingMerchant(true);
      try {
        const data = await obterDadosLojista(activeSlug);
        setMerchant(data);
      } catch (err: any) {
        console.error('Erro ao carregar loja:', err);
      } finally {
        setLoadingMerchant(false);
      }
    }
    loadStore();
  }, [activeSlug]);

  // Formata máscara de celular enquanto digita
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/\D/g, '');
    if (v.length > 11) v = v.slice(0, 11);

    if (v.length > 6) {
      v = `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
    } else if (v.length > 2) {
      v = `(${v.slice(0, 2)}) ${v.slice(2)}`;
    } else if (v.length > 0) {
      v = `(${v}`;
    }
    setCelular(v);
  };

  // Temporizador do TOTP para demonstrar a rotação do passe
  useEffect(() => {
    if (!enrolledResult) return;

    const updateBarcode = async () => {
      const now = Date.now();
      const secondsInPeriod = Math.floor((now % 30000) / 1000);
      const remaining = 30 - secondsInPeriod;
      setTotpSecondsLeft(remaining);

      if (!enrolledResult.totpSecret) return;
      const code = await gerarCodigoTotpAtual(enrolledResult.totpSecret);
      setTotpCode(code);

      const qrContent = `MIMO:${enrolledResult.cartaoId}:${code}`;
      try {
        const url = await QRCode.toDataURL(qrContent, {
          width: 260,
          margin: 1,
          color: { dark: '#000000', light: '#FFFFFF' }
        });
        setQrCodeDataUrl(url);
      } catch (e) {
        console.error('Erro ao gerar QR code:', e);
      }
    };

    updateBarcode();
    const interval = setInterval(updateBarcode, 1000);
    return () => clearInterval(interval);
  }, [enrolledResult]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!consentimento) {
      setErrorMsg('É obrigatório aceitar os termos de consentimento para emissão do cartão.');
      return;
    }

    const apenasNumeros = celular.replace(/\D/g, '');
    if (apenasNumeros.length < 10) {
      setErrorMsg('Informe um número de celular válido com DDD (mínimo 10 dígitos).');
      return;
    }

    // Se loja exigir SMS e ainda não passou pelo step
    if (merchant?.regras?.exigirSMS && !smsStep) {
      setSmsStep(true);
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await cadastrarClienteECartao({
        lojaId: merchant?.slug || activeSlug,
        nome,
        celular,
        email,
        aniversario: aniversario || undefined,
        consentimento: true,
      });

      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#FFC82C', '#10B981', '#0F172A']
      });

      setEnrolledResult(result);
    } catch (err: any) {
      setErrorMsg(err.message || 'Ocorreu um erro ao emitir o cartão. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingMerchant) {
    return (
      <div className="min-h-screen bg-[#0E0E10] flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3 animate-pulse">
          <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-semibold tracking-wide text-zinc-400">Carregando programa de fidelidade...</span>
        </div>
      </div>
    );
  }

  const loja: SeedMerchantData = merchant || {
    nome: 'Minha Loja',
    slug: 'minha-loja',
    ativo: true,
    statusFinanceiro: 'adimplente',
    financeiro: {
      status: 'adimplente',
      plano: 'pro',
      valorMensal: 149,
      bloqueadoPorInadimplencia: false
    },
    layout: {
      corFundo: '#141416',
      corTexto: '#FFFFFF',
      nomePrograma: 'Clube Fidelidade',
      premio: 'Recompensa Especial (10º Selo)',
      logoUrl: '',
      heroUrl: '',
    },
    regras: {
      meta: 10,
      intervaloMinimoMin: 30,
      maxSelosDiaPorCliente: 2,
      validadeDias: 180,
      exigirSMS: false,
    },
    wallet: {
      classId: '3388000000023184117.fidelidade',
      classSincronizadaEm: new Date().toISOString()
    },
    operadores: {
      operador_balcao: { nome: 'Operador de Balcão', pin: '1234', papel: 'operador' }
    },
    criadoEm: new Date().toISOString()
  };

  return (
    <div className="min-h-screen bg-[#0A0A0C] text-zinc-100 flex flex-col items-center justify-center px-4 py-8 antialiased selection:bg-amber-400 selection:text-black">
      {/* Botão de retorno sutil */}
      {onBackToSite && (
        <button
          onClick={onBackToSite}
          className="fixed top-4 left-4 z-40 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-900/80 border border-zinc-800 text-xs text-zinc-400 hover:text-white transition-all backdrop-blur"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Voltar ao Portal</span>
        </button>
      )}

      <div className="max-w-md w-full relative z-10">
        {loja.statusFinanceiro === 'inadimplente' || loja.financeiro?.bloqueadoPorInadimplencia ? (
          <div className="bg-[#141417] border border-amber-500/30 rounded-3xl p-6 sm:p-8 space-y-5 shadow-2xl text-center animate-fade-in relative overflow-hidden">
            <div className="w-16 h-16 rounded-full bg-amber-500/10 border-2 border-amber-500 flex items-center justify-center mx-auto text-amber-400 shadow-lg shadow-amber-500/10">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div>
              <span className="text-[11px] font-bold uppercase tracking-widest text-amber-400 block mb-1">
                AVISO DA LOJA
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white">
                Programa Temporariamente Pausado
              </h2>
              <p className="text-xs text-zinc-400 mt-2 max-w-sm mx-auto leading-relaxed">
                O programa de fidelidade do estabelecimento <strong className="text-white">{loja.nome}</strong> está em atualização cadastral ou manutenção temporária.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-400 space-y-1">
              <p>Por favor, procure o caixa ou a gerência da loja para mais informações sobre seus selos acumulados.</p>
            </div>
          </div>
        ) : enrolledResult ? (
          /* ── TELA "PRONTO!" COM BOTÃO OFICIAL GOOGLE WALLET ── */
          <div className="bg-[#141417] border border-zinc-800/80 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl text-center animate-fade-in relative overflow-hidden">
            {/* Glow decorativo de fundo */}
            <div
              className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full blur-3xl opacity-20 pointer-events-none"
              style={{ backgroundColor: loja.layout.corFundo || '#FFC82C' }}
            />

            {/* Ícone de Sucesso */}
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border-2 border-emerald-500 flex items-center justify-center mx-auto text-emerald-400 shadow-lg shadow-emerald-500/10">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-400 block mb-1">
                {enrolledResult.jaExistia ? 'CARTÃO LOCALIZADO!' : 'CADASTRO CONCLUÍDO!'}
              </span>
              <h1 className="text-2xl font-black text-white">
                Seu Cartão Fidelidade Está Pronto
              </h1>
              <p className="text-xs text-zinc-400 mt-2 max-w-sm mx-auto">
                Adicione o cartão à sua carteira digital para acumular selos no balcão e resgatar{' '}
                <strong className="text-white">{loja.layout.premio}</strong>.
              </p>
            </div>

            {/* BOTÃO OFICIAL ADICIONAR À GOOGLE WALLET */}
            <div className="p-5 rounded-2xl bg-[#1C1C22] border border-zinc-700/60 space-y-3">
              <span className="text-[11px] uppercase font-bold text-zinc-400 tracking-wider block">
                Google Wallet (Disponível para Android & iOS)
              </span>

              <div className="flex justify-center my-1">
                <GoogleWalletBadge
                  href={enrolledResult.saveUrl}
                />
              </div>

              <p className="text-[11px] text-zinc-400 leading-snug">
                Clique no botão acima para salvar diretamente no app Google Carteira do seu smartphone.
              </p>
            </div>

            {/* PRÉVIA VISUAL DO PASSE GOOGLE WALLET */}
            <div
              className="rounded-3xl p-5 sm:p-6 border text-left relative overflow-hidden shadow-2xl"
              style={{
                backgroundColor: loja.layout.corFundo || '#141416',
                borderColor: 'rgba(255, 255, 255, 0.15)',
                color: loja.layout.corTexto || '#FFFFFF'
              }}
            >
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/10" />

              {/* Pass Header com Logo e Dados da Loja */}
              <div className="relative z-10 flex items-start justify-between border-b border-white/10 pb-3.5">
                <div className="flex items-center gap-2.5">
                  {loja.layout.logoUrl ? (
                    <div className="h-10 w-10 rounded-xl bg-black/40 border border-white/20 p-1 flex items-center justify-center overflow-hidden shrink-0 shadow-md">
                      <img src={loja.layout.logoUrl} alt={loja.nome} className="h-full w-full object-contain" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-amber-400/20 text-amber-400 flex items-center justify-center font-bold text-sm shrink-0 border border-amber-400/30">
                      {loja.nome.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h3 className="text-base font-black leading-tight">{loja.nome}</h3>
                    <span className="text-[10px] text-white/70 block uppercase font-bold tracking-wider">
                      {loja.layout.nomePrograma || 'CARTÃO DE FIDELIDADE'}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[9px] uppercase font-bold text-white/50 block tracking-widest">
                    STATUS
                  </span>
                  <span className="text-xs font-semibold text-emerald-400">
                    Ativo
                  </span>
                </div>
              </div>

              {/* Informações do Cliente VIP no Cabeçalho */}
              <div className="relative z-10 py-3 flex items-center justify-between text-xs border-b border-white/5">
                <div>
                  <span className="text-[9px] uppercase font-bold text-white/40 block tracking-wider">CLIENTE VIP</span>
                  <span className="text-xs sm:text-sm font-bold text-white truncate max-w-[170px] block">
                    {nome || 'Cliente VIP'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[9px] uppercase font-bold text-white/40 block tracking-wider">PROGRESSO</span>
                  <span className="text-xs sm:text-sm font-black text-amber-400">
                    {enrolledResult.selos} / {enrolledResult.meta || 10} SELOS
                  </span>
                </div>
              </div>

              {/* ═══════════════════════════════════════════════════════════════
                  CARTELA DE SELOS GOOGLE WALLET (2x5 GRID CIRCULAR)
                 ═══════════════════════════════════════════════════════════════ */}
              <div className="relative z-10 my-3.5 p-4 rounded-2xl bg-[#18181b] border border-white/10 shadow-inner">
                <div className="grid grid-cols-5 gap-2.5 justify-items-center">
                  {Array.from({ length: enrolledResult.meta || 10 }).map((_, index) => {
                    const slotNum = index + 1;
                    const isFilled = slotNum <= enrolledResult.selos;
                    const is10th = slotNum === 10;

                    if (is10th) {
                      // 10º Selo: Selo Especial do Prêmio com Estrela Dourada
                      return (
                        <div key={slotNum} className="relative flex items-center justify-center">
                          <div className="absolute -top-1 -right-1 z-10 w-4 h-4 rounded-full bg-white text-amber-500 flex items-center justify-center text-[9px] shadow-md font-bold leading-none border border-amber-200">
                            ⭐
                          </div>
                          <div
                            className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center p-1 shadow-lg transition-transform ${
                              isFilled
                                ? 'text-black shadow-amber-400/40 ring-2 ring-amber-300 scale-105'
                                : 'text-black shadow-amber-400/20 border-2 border-white/60'
                            }`}
                            style={{ backgroundColor: loja.layout.accentColor || '#FFC82C' }}
                          >
                            {loja.layout.rewardStampImage ? (
                              <img
                                src={loja.layout.rewardStampImage}
                                alt="Prêmio"
                                className="w-full h-full object-contain rounded-full"
                              />
                            ) : (
                              <span className="text-[7px] sm:text-[7.5px] font-black uppercase text-center leading-[1.05] tracking-tight text-zinc-950 line-clamp-3 select-none px-0.5">
                                {loja.layout.premio || 'BROWNIE COOKIE GRÁTIS'}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    }

                    if (isFilled) {
                      // Selos 1 a 9 Preenchidos: Medalha Dourada
                      return (
                        <div
                          key={slotNum}
                          className="w-10 h-10 sm:w-11 sm:h-11 rounded-full p-[2px] bg-gradient-to-b from-[#FFE57F] via-[#F59E0B] to-[#92400E] shadow-md shadow-amber-500/25 flex items-center justify-center transition-transform"
                        >
                          <div className="w-full h-full rounded-full bg-gradient-to-tr from-[#78350F] via-[#B45309] to-[#D97706] border border-[#FEF3C7]/50 flex items-center justify-center text-amber-100 shadow-inner overflow-hidden">
                            {loja.layout.stampImage ? (
                              <img
                                src={loja.layout.stampImage}
                                alt="Selo"
                                className="w-full h-full object-cover rounded-full"
                              />
                            ) : loja.layout.stampIcon === 'cookie' ? (
                              <span className="text-base select-none filter drop-shadow">🍪</span>
                            ) : loja.layout.stampIcon === 'coffee' ? (
                              <span className="text-base select-none filter drop-shadow">☕</span>
                            ) : loja.layout.stampIcon === 'star' ? (
                              <span className="text-base select-none filter drop-shadow">⭐</span>
                            ) : loja.layout.stampIcon === 'heart' ? (
                              <span className="text-base select-none filter drop-shadow">❤️</span>
                            ) : loja.layout.stampIcon === 'sparkle' ? (
                              <span className="text-base select-none filter drop-shadow">✨</span>
                            ) : loja.layout.stampIcon === 'fire' ? (
                              <span className="text-base select-none filter drop-shadow">🔥</span>
                            ) : (
                              <span className="text-base select-none filter drop-shadow">🪙</span>
                            )}
                          </div>
                        </div>
                      );
                    }

                    // Selos 1 a 9 Vazios
                    return (
                      <div
                        key={slotNum}
                        className="w-10 h-10 sm:w-11 sm:h-11 rounded-full border border-white/15 bg-white/5 flex items-center justify-center transition-all"
                      >
                        <span className="text-[10px] font-semibold text-white/20 select-none">
                          {slotNum}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ═══════════════════════════════════════════════════════════════
                  CARDS INFORMATIVOS GOOGLE WALLET
                 ═══════════════════════════════════════════════════════════════ */}
              <div className="space-y-2 relative z-10 text-left my-2">
                {/* Card 1: Stamps */}
                <div className="bg-[#242428] rounded-xl p-3 border border-white/5">
                  <span className="text-[10px] text-zinc-400 font-medium block">Stamps</span>
                  <p className="text-xs font-semibold text-white mt-0.5 leading-snug">
                    {loja.layout.instrucaoResgate || 'Here you will see your of stamps'}
                  </p>
                </div>

                {/* Card 2: Selos */}
                <div className="bg-[#242428] rounded-xl p-3 border border-white/5 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-zinc-400 font-medium block">Selos</span>
                    <p className="text-xs font-bold text-white mt-0.5">
                      {enrolledResult.selos}/{enrolledResult.meta || 10}
                    </p>
                  </div>
                  <span className="text-[9px] font-bold text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-full border border-amber-400/20 uppercase tracking-wider">
                    Google Wallet
                  </span>
                </div>
              </div>

              {/* QR Code Rotativo da Google Wallet */}
              <div className="bg-white rounded-2xl p-4 text-center text-zinc-900 space-y-2 mt-3 relative z-10">
                <div className="flex items-center justify-between text-[11px] font-bold text-zinc-600 px-1">
                  <span>QR Rotativo Dinâmico</span>
                  <span className="flex items-center gap-1 text-emerald-600">
                    <Clock className="w-3 h-3" />
                    <span>{totpSecondsLeft}s</span>
                  </span>
                </div>

                {qrCodeDataUrl ? (
                  <img
                    src={qrCodeDataUrl}
                    alt="QR Code do Passe"
                    className="w-44 h-44 mx-auto rounded-lg shadow-sm"
                  />
                ) : (
                  <div className="w-44 h-44 mx-auto bg-zinc-100 rounded-lg flex items-center justify-center text-xs text-zinc-400 animate-pulse">
                    Gerando QR seguro...
                  </div>
                )}

                <div className="text-[10px] font-mono text-zinc-500">
                  Código de segurança: <strong className="text-black font-bold tracking-widest">{totpCode}</strong>
                </div>
                <p className="text-[10px] text-zinc-400">
                  Apresente este código no caixa para receber seus carimbos.
                </p>
              </div>
            </div>

            <p className="text-[11px] text-zinc-500">
              O cartão vive na sua Google Wallet. Não é necessário lembrar senhas ou baixar novos aplicativos.
            </p>
          </div>
        ) : (
          /* ── FORMULÁRIO DE CADASTRO DO CLIENTE (/c/{slug}) ── */
          <div className="bg-[#141417] border border-zinc-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl animate-fade-in relative overflow-hidden">
            {/* Header da Loja */}
            <div className="text-center space-y-2">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-lg mx-auto shadow-md border border-white/10"
                style={{ backgroundColor: loja.layout.corFundo || '#141416', color: loja.layout.corTexto || '#FFFFFF' }}
              >
                {loja.nome.slice(0, 2).toUpperCase()}
              </div>

              <h2 className="text-xl sm:text-2xl font-black text-white">
                {loja.nome}
              </h2>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-400 text-xs font-bold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{loja.layout.nomePrograma}</span>
              </div>

              <p className="text-xs text-zinc-400 max-w-xs mx-auto pt-1 leading-relaxed">
                Junte 10 selos a cada visita e ganhe{' '}
                <strong className="text-zinc-200">{loja.layout.premio}</strong> direto na sua Google Wallet.
              </p>
            </div>

            {errorMsg && (
              <div className="bg-rose-500/10 border border-rose-500/30 p-3 rounded-xl text-rose-300 text-xs font-semibold flex items-center gap-2 animate-shake">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* FORMULÁRIO */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Nome */}
              <div>
                <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">
                  Seu Nome Completo *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Ex: Ana Clara Souza"
                    className="w-full bg-[#1A1A1F] border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all"
                  />
                </div>
              </div>

              {/* Celular / WhatsApp */}
              <div>
                <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">
                  Celular / WhatsApp (Chave do Cartão) *
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    required
                    value={celular}
                    onChange={handlePhoneChange}
                    placeholder="(11) 98765-4321"
                    className="w-full bg-[#1A1A1F] border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 font-mono transition-all"
                  />
                </div>
                <span className="text-[10px] text-zinc-500 block mt-1">
                  Usado para identificar seus selos no balcão caso esqueça o celular.
                </span>
              </div>

              {/* E-mail */}
              <div>
                <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">
                  E-mail *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu.email@exemplo.com"
                    className="w-full bg-[#1A1A1F] border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all"
                  />
                </div>
              </div>

              {/* Aniversário */}
              <div>
                <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">
                  Data de Aniversário (Selo Bônus!)
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="date"
                    value={aniversario}
                    onChange={(e) => setAniversario(e.target.value)}
                    className="w-full bg-[#1A1A1F] border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all"
                  />
                </div>
                <span className="text-[10px] text-amber-400/80 block mt-1">
                  🎁 Clientes aniversariantes recebem 1 selo bônus automático no dia!
                </span>
              </div>

              {/* SMS Verification Modal/Input (Se exigido pela loja) */}
              {smsStep && (
                <div className="p-4 rounded-xl bg-amber-400/10 border border-amber-400/30 space-y-2 animate-fade-in">
                  <span className="text-xs font-bold text-amber-300 block">
                    Código de Confirmação SMS
                  </span>
                  <p className="text-[11px] text-zinc-300">
                    Enviamos um SMS com código de 6 dígitos para <strong>{celular}</strong>.
                  </p>
                  <input
                    type="text"
                    maxLength={6}
                    value={smsCode}
                    onChange={(e) => setSmsCode(e.target.value)}
                    placeholder="123456"
                    className="w-full bg-zinc-900 border border-amber-400/60 rounded-xl px-4 py-2.5 text-center text-lg font-mono font-bold tracking-widest text-amber-400 focus:outline-none"
                  />
                </div>
              )}

              {/* Consentimento LGPD */}
              <div className="pt-2">
                <label className="flex items-start gap-2.5 cursor-pointer text-left">
                  <input
                    type="checkbox"
                    checked={consentimento}
                    onChange={(e) => setConsentimento(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-amber-400 focus:ring-amber-400 focus:ring-offset-zinc-900 cursor-pointer"
                  />
                  <span className="text-[11px] text-zinc-400 leading-snug">
                    Concordo em emitir meu cartão de fidelidade na Google Wallet e receber comunicações de saldo e prêmios conforme a Lei Geral de Proteção de Dados (LGPD).
                  </span>
                </label>
              </div>

              {/* Botão de Envio */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-black font-extrabold py-3.5 px-6 rounded-xl shadow-lg shadow-amber-400/20 flex items-center justify-center gap-2 text-sm transition-all duration-200 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    <span>Emitindo Cartão na Carteira...</span>
                  </>
                ) : (
                  <>
                    <span>Criar Cartão & Salvar na Carteira</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="flex items-center justify-center gap-2 text-[11px] text-zinc-500 pt-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Emissão Instantânea • Oficial Google Wallet</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerEnrollSlug;
