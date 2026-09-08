import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import confetti from 'canvas-confetti';
import { MimoLogo } from './MimoLogo.js';
import { 
  QrCode, UserPlus, Sparkles, CheckCircle2, ArrowRight, 
  Smartphone, Share2, Camera, X, Gift, ChevronRight, Apple,
  Search, Lock, Mail, Phone, Clock
} from 'lucide-react';

export type MobileScreenId = 
  | 'login' 
  | 'home' 
  | 'convite' 
  | 'scanner' 
  | 'selo-sucesso' 
  | 'recompensa' 
  | 'cadastro' 
  | 'wallet-pass';

interface MimoMobileAppProps {
  initialScreen?: MobileScreenId;
  onExitToDesktop?: () => void;
  standalone?: boolean;
}

export const MimoMobileApp: React.FC<MimoMobileAppProps> = ({
  initialScreen = 'home',
  onExitToDesktop,
  standalone = false
}) => {
  const [currentScreen, setCurrentScreen] = useState<MobileScreenId>(initialScreen);
  const [timerSeconds, setTimerSeconds] = useState(899);
  const [stampsCount, setStampsCount] = useState(9);
  const [serialCode, setSerialCode] = useState('8F3A-92BC-41DE');
  const [customerName, setCustomerName] = useState('Mariana Silva');

  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const passQrRef = useRef<HTMLCanvasElement | null>(null);

  // Countdown timer for invite QR
  useEffect(() => {
    if (currentScreen === 'convite') {
      const interval = setInterval(() => {
        setTimerSeconds((prev) => (prev > 0 ? prev - 1 : 900));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [currentScreen]);

  // Generate QR for invite
  useEffect(() => {
    if (qrCanvasRef.current && currentScreen === 'convite') {
      QRCode.toCanvas(
        qrCanvasRef.current,
        'https://mimo-fidelidade.web.app/c/minha-loja',
        {
          width: 200,
          margin: 1,
          color: { dark: '#0F0F10', light: '#FFFFFF' }
        },
        (err) => { if (err) console.error(err); }
      );
    }
  }, [currentScreen]);

  // Generate QR for Wallet Pass
  useEffect(() => {
    if (passQrRef.current && currentScreen === 'wallet-pass') {
      QRCode.toCanvas(
        passQrRef.current,
        'mimo-pass-minha-loja-8f3a',
        {
          width: 130,
          margin: 1,
          color: { dark: '#0F0F10', light: '#FFFFFF' }
        },
        (err) => { if (err) console.error(err); }
      );
    }
  }, [currentScreen]);

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleScanSuccess = () => {
    // If stamps reached 9, next is reward (10)
    if (stampsCount >= 9) {
      setStampsCount(10);
      setCurrentScreen('recompensa');
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 } });
    } else {
      setStampsCount(9);
      setCurrentScreen('selo-sucesso');
    }
  };

  const screensOrder: Array<{ id: MobileScreenId; title: string }> = [
    { id: 'login', title: '1. Login' },
    { id: 'home', title: '2. Balcão' },
    { id: 'convite', title: '3. QR Convite' },
    { id: 'scanner', title: '4. Scanner' },
    { id: 'selo-sucesso', title: '5. Selo 9/10' },
    { id: 'recompensa', title: '6. Recompensa' },
    { id: 'cadastro', title: '7. Cadastro' },
    { id: 'wallet-pass', title: '8. Wallet Pass' },
  ];

  return (
    <div className="flex flex-col items-center justify-center p-2 sm:p-6 w-full animate-fade-in">
      {/* Interactive Flow Switcher Tabs */}
      <div className="mb-4 flex items-center gap-1.5 overflow-x-auto max-w-full pb-2 px-2">
        {screensOrder.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setCurrentScreen(s.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
              currentScreen === s.id
                ? 'bg-[#FFC82C] text-black shadow-md shadow-[#FFC82C]/30 scale-105'
                : 'bg-white/10 text-white/70 hover:bg-white/15'
            }`}
          >
            {s.title}
          </button>
        ))}
      </div>

      {/* Realistic Smartphone Shell (iPhone Frame) */}
      <div className="w-full max-w-[380px] bg-black rounded-[48px] p-3.5 shadow-2xl border-4 border-[#27272A] relative overflow-hidden">
        {/* Dynamic Island Notch */}
        <div className="w-28 h-5 bg-black rounded-full mx-auto mb-2 flex items-center justify-end px-3">
          <div className="w-2.5 h-2.5 rounded-full bg-[#18181B] border border-[#27272A]"></div>
        </div>

        {/* Screen Content Window */}
        <div className="w-full bg-[#0F0F10] rounded-[36px] overflow-hidden min-h-[640px] flex flex-col text-white relative">
          
          {/* ══════════ SCREEN 1: LOGIN MOBILE ══════════ */}
          {currentScreen === 'login' && (
            <div className="flex-1 flex flex-col justify-between p-6 animate-fade-in">
              <div className="pt-8 space-y-6">
                <div className="flex justify-center">
                  <MimoLogo size="lg" showSubtitle={true} />
                </div>

                <div className="text-center space-y-1">
                  <h2 className="text-xl font-black text-white">Painel do Lojista</h2>
                  <p className="text-xs text-white/50">Acesse para gerenciar sua loja no caixa</p>
                </div>

                <div className="space-y-3 pt-2">
                  <div>
                    <label className="text-[11px] font-bold text-white/60 uppercase block mb-1">E-mail</label>
                    <input
                      type="email"
                      defaultValue="lojista@minhaloja.com.br"
                      className="input-mimo-dark text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-white/60 uppercase block mb-1">Senha</label>
                    <input
                      type="password"
                      defaultValue="••••••••"
                      className="input-mimo-dark text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3 pb-4">
                <button
                  type="button"
                  onClick={() => setCurrentScreen('home')}
                  className="btn-mimo-yellow w-full text-xs font-bold py-3.5 shadow-lg"
                >
                  <span>Entrar no Painel</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => alert('Recuperação de senha enviada!')}
                  className="w-full text-center text-xs text-white/40 hover:text-white"
                >
                  Esqueci minha senha
                </button>
              </div>
            </div>
          )}

          {/* ══════════ SCREEN 2: BALCÃO HOME ══════════ */}
          {currentScreen === 'home' && (
            <div className="flex-1 flex flex-col p-5 space-y-4 animate-fade-in">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/8 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[#FFC82C] text-black font-black flex items-center justify-center text-xs">
                    P
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white leading-tight">Minha Loja</h3>
                    <span className="text-[10px] text-emerald-400 font-semibold">Caixa Aberto</span>
                  </div>
                </div>
                <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold">
                  PC
                </div>
              </div>

              {/* 3 Quick Counters */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-[#16161A] p-3 rounded-2xl border border-white/8 text-center">
                  <span className="text-[10px] font-bold text-white/40 uppercase block">Hoje</span>
                  <div className="text-lg font-black text-white mt-0.5">42</div>
                </div>
                <div className="bg-[#16161A] p-3 rounded-2xl border border-white/8 text-center">
                  <span className="text-[10px] font-bold text-white/40 uppercase block">Mês</span>
                  <div className="text-lg font-black text-[#FFC82C] mt-0.5">518</div>
                </div>
                <div className="bg-[#16161A] p-3 rounded-2xl border border-white/8 text-center">
                  <span className="text-[10px] font-bold text-white/40 uppercase block">Prêmios</span>
                  <div className="text-lg font-black text-emerald-400 mt-0.5">8</div>
                </div>
              </div>

              {/* Big Yellow Action Card 1: Novo Cliente */}
              <div
                onClick={() => setCurrentScreen('convite')}
                className="bg-[#FFC82C] text-black p-4 rounded-3xl shadow-lg cursor-pointer hover:bg-amber-300 transition-transform active:scale-98 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-2xl bg-black/15 flex items-center justify-center font-bold">
                    <UserPlus className="w-5 h-5 text-black" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider bg-black/15 px-2 py-0.5 rounded-full">
                    QR CONVITE
                  </span>
                </div>
                <div>
                  <h4 className="text-base font-black text-black">Novo Cliente</h4>
                  <p className="text-xs text-black/80 font-medium">
                    Toque para gerar QR de convite e cadastrar no balcão em 30s
                  </p>
                </div>
              </div>

              {/* Action Card 2: Escanear Cartão */}
              <div
                onClick={() => setCurrentScreen('scanner')}
                className="bg-[#1F1F24] border border-white/10 p-4 rounded-3xl cursor-pointer hover:border-[#FFC82C] transition-all active:scale-98 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-2xl bg-white/10 flex items-center justify-center font-bold text-[#FFC82C]">
                    <Camera className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold text-white/40 uppercase">
                    CÂMERA
                  </span>
                </div>
                <div>
                  <h4 className="text-sm font-black text-white">Escanear Cartão</h4>
                  <p className="text-xs text-white/50">
                    Ler QR Code da carteira do cliente para carimbar selo
                  </p>
                </div>
              </div>

              {/* Section: Últimos Selos */}
              <div className="space-y-2 pt-1">
                <span className="text-[11px] font-bold text-white/40 uppercase tracking-wider block">
                  Últimos Selos Carimbados
                </span>
                <div className="space-y-1.5 text-xs">
                  <div className="p-2.5 bg-[#16161A] rounded-xl border border-white/6 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-white">Mariana Silva</p>
                      <span className="text-[10px] text-white/40">Há 5 min</span>
                    </div>
                    <span className="font-mono font-bold text-[#FFC82C] bg-[#FFC82C]/10 px-2 py-0.5 rounded text-[11px]">
                      9/10 Selos
                    </span>
                  </div>
                  <div className="p-2.5 bg-[#16161A] rounded-xl border border-white/6 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-white">Carlos Souza</p>
                      <span className="text-[10px] text-white/40">Há 18 min</span>
                    </div>
                    <span className="font-mono font-bold text-[#FFC82C] bg-[#FFC82C]/10 px-2 py-0.5 rounded text-[11px]">
                      4/10 Selos
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══════════ SCREEN 3: CONVITE QR MOBILE ══════════ */}
          {currentScreen === 'convite' && (
            <div className="flex-1 flex flex-col justify-between p-6 text-center animate-fade-in">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/8 pb-3">
                <span className="text-xs font-bold text-white">Minha Loja</span>
                <button
                  type="button"
                  onClick={() => setCurrentScreen('home')}
                  className="p-1 rounded-full text-white/50 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 my-auto">
                <div>
                  <h3 className="text-lg font-black text-white">Aponte a Câmera</h3>
                  <p className="text-xs text-white/60 mt-0.5">
                    Peça para o cliente escanear e salvar o cartão na carteira digital
                  </p>
                </div>

                {/* Big White QR Code */}
                <div className="p-4 bg-white rounded-3xl shadow-2xl inline-block mx-auto">
                  <canvas ref={qrCanvasRef} className="w-48 h-48 mx-auto" />
                </div>

                <div className="flex items-center justify-center gap-1.5 text-xs text-[#FFC82C] font-bold">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Válido por {formatTimer(timerSeconds)}</span>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCurrentScreen('cadastro')}
                  className="btn-mimo-yellow w-full text-xs font-bold py-3.5"
                >
                  Simular Escaneamento do Cliente →
                </button>
              </div>
            </div>
          )}

          {/* ══════════ SCREEN 4: SCANNER DE CÂMERA ══════════ */}
          {currentScreen === 'scanner' && (
            <div className="flex-1 flex flex-col justify-between p-6 animate-fade-in">
              <div className="flex items-center justify-between border-b border-white/8 pb-3">
                <span className="text-xs font-bold text-white">Scanner de Cartão</span>
                <button
                  type="button"
                  onClick={() => setCurrentScreen('home')}
                  className="p-1 rounded-full text-white/50 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Viewfinder with 4 Yellow Corner Guides */}
              <div className="my-auto space-y-4 text-center">
                <div className="scanner-viewfinder bg-black/60 rounded-3xl border border-white/10 flex items-center justify-center relative overflow-hidden">
                  <div className="scanner-corner-tl" />
                  <div className="scanner-corner-tr" />
                  <div className="scanner-corner-bl" />
                  <div className="scanner-corner-br" />
                  <div className="scanner-laser" />

                  <QrCode className="w-24 h-24 text-white/20" />
                </div>

                <p className="text-xs text-white/70">
                  Aponte para o QR Code da Apple ou Google Wallet
                </p>

                {/* Manual Serial Entry Option */}
                <div className="p-3 bg-[#16161A] rounded-2xl border border-white/8 space-y-2 text-left">
                  <span className="text-[10px] font-bold text-white/40 uppercase block">
                    Ou digite o serial do cliente:
                  </span>
                  <input
                    type="text"
                    value={serialCode}
                    onChange={(e) => setSerialCode(e.target.value)}
                    className="input-mimo-dark font-mono text-xs text-center tracking-wider text-[#FFC82C]"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleScanSuccess}
                className="btn-mimo-yellow w-full text-xs font-bold py-3.5 shadow-lg"
              >
                <Sparkles className="w-4 h-4" />
                <span>Confirmar e Carimbar Selo</span>
              </button>
            </div>
          )}

          {/* ══════════ SCREEN 5: SUESSO - SELO REGISTRADO! (9/10) ══════════ */}
          {currentScreen === 'selo-sucesso' && (
            <div className="flex-1 flex flex-col justify-between p-6 text-center animate-fade-in">
              <div className="my-auto space-y-5">
                {/* Big Yellow Checkmark */}
                <div className="w-20 h-20 rounded-full bg-[#FFC82C] text-black flex items-center justify-center mx-auto shadow-xl shadow-[#FFC82C]/30">
                  <CheckCircle2 className="w-10 h-10" />
                </div>

                <div>
                  <span className="text-[11px] font-bold uppercase tracking-widest text-[#FFC82C]">
                    SUCESSO
                  </span>
                  <h2 className="text-2xl font-black text-white mt-1">
                    Selo registrado!
                  </h2>
                  <p className="text-xs text-white/60 mt-1">
                    {customerName} • Minha Loja
                  </p>
                </div>

                {/* Big Card with 9/10 Selos */}
                <div className="p-5 bg-[#16161A] rounded-3xl border border-white/10 space-y-3 shadow-lg">
                  <span className="text-xs font-bold text-white/50 uppercase">Saldo Atual</span>
                  <div className="text-4xl font-black text-[#FFC82C] font-mono">
                    9 / 10 Selos
                  </div>
                  <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full bg-[#FFC82C] rounded-full" style={{ width: '90%' }} />
                  </div>
                  <p className="text-xs text-white/70 font-semibold">
                    Falta apenas 1 selo para ganhar <strong>1 Café Espresso Grátis</strong>!
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCurrentScreen('home')}
                className="btn-mimo-yellow w-full text-xs font-bold py-3.5"
              >
                Próximo Cliente
              </button>
            </div>
          )}

          {/* ══════════ SCREEN 6: RECOMPENSA DISPONÍVEL! (10º SELO) ══════════ */}
          {currentScreen === 'recompensa' && (
            <div className="flex-1 flex flex-col justify-between p-6 text-center animate-fade-in">
              <div className="my-auto space-y-5">
                {/* Golden Trophy Icon */}
                <div className="w-20 h-20 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/30">
                  <Gift className="w-10 h-10" />
                </div>

                <div>
                  <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-400">
                    PARABÉNS!
                  </span>
                  <h2 className="text-2xl font-black text-white mt-1">
                    Recompensa disponível!
                  </h2>
                  <p className="text-xs text-white/60 mt-1">
                    {customerName} completou os 10 selos
                  </p>
                </div>

                {/* Highlight Reward Card */}
                <div className="p-5 bg-[#16161A] rounded-3xl border-2 border-emerald-500/50 space-y-2 shadow-xl">
                  <span className="text-xs font-bold text-emerald-400 uppercase">Item a ser entregue</span>
                  <div className="text-lg font-black text-white">
                    ☕ 1 Café Espresso Grátis
                  </div>
                  <span className="text-[11px] text-white/50 block">
                    Toque no botão abaixo para confirmar a entrega no balcão
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  alert('Recompensa entregue! Ciclo #2 iniciado.');
                  setCurrentScreen('home');
                }}
                className="btn-mimo-green w-full text-xs font-bold py-3.5 shadow-lg"
              >
                Confirmar Entrega da Recompensa
              </button>
            </div>
          )}

          {/* ══════════ SCREEN 7: PWA CONSUMIDOR - CADASTRO ══════════ */}
          {currentScreen === 'cadastro' && (
            <div className="flex-1 flex flex-col justify-between p-5 animate-fade-in">
              <div className="space-y-4">
                {/* Store Banner */}
                <div className="h-28 rounded-2xl bg-gradient-to-br from-amber-600 to-amber-900 flex items-center justify-center relative overflow-hidden shadow-md">
                  <div className="absolute inset-0 bg-black/30" />
                  <div className="relative text-center">
                    <div className="w-9 h-9 rounded-xl bg-[#FFC82C] text-black font-black flex items-center justify-center text-sm mx-auto shadow-md">
                      P
                    </div>
                    <span className="text-xs font-bold text-white mt-1 block">Minha Loja</span>
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-black text-white">Cadastre-se e ganhe!</h3>
                  <p className="text-xs text-white/60 mt-0.5">
                    Junte 10 selos e ganhe 1 Café Espresso Grátis na sua carteira digital.
                  </p>
                </div>

                <div className="space-y-2.5">
                  <input
                    type="text"
                    defaultValue="Mariana Silva"
                    placeholder="Nome Completo"
                    className="input-mimo-dark text-xs"
                  />
                  <input
                    type="email"
                    defaultValue="mariana.silva@email.com"
                    placeholder="E-mail"
                    className="input-mimo-dark text-xs"
                  />
                  <input
                    type="tel"
                    defaultValue="(11) 98765-4321"
                    placeholder="WhatsApp"
                    className="input-mimo-dark text-xs"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCurrentScreen('wallet-pass')}
                className="btn-mimo-yellow w-full text-xs font-bold py-3.5 mt-4"
              >
                Salvar na Carteira Digital
              </button>
            </div>
          )}

          {/* ══════════ SCREEN 8: PWA CONSUMIDOR - ADICIONAR À WALLET ══════════ */}
          {currentScreen === 'wallet-pass' && (
            <div className="flex-1 flex flex-col justify-between p-5 text-center animate-fade-in">
              <div className="space-y-4">
                <div>
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-1">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-black text-white">Cadastro Realizado!</h3>
                  <p className="text-xs text-white/60">
                    Toque abaixo para guardar o cartão na sua carteira
                  </p>
                </div>

                {/* Mini Wallet Pass Mockup */}
                <div className="bg-[#16161A] border-2 border-[#2E2E38] rounded-2xl p-4 text-white shadow-xl space-y-2 max-w-[280px] mx-auto">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <span className="text-[10px] font-black text-white">Minha Loja</span>
                    <span className="text-[9px] font-mono text-[#FFC82C]">0/10 SELOS</span>
                  </div>

                  <div className="p-2 bg-black/40 rounded-lg text-[10px] text-white/80">
                    ☕ 1 Café Espresso Grátis
                  </div>

                  <div className="bg-white p-2 rounded-lg inline-block">
                    <canvas ref={passQrRef} className="w-24 h-24 mx-auto" />
                  </div>
                </div>
              </div>

              {/* Official Apple & Google Buttons */}
              <div className="space-y-2 pb-2">
                <button
                  type="button"
                  onClick={() => alert('Pass oficial adicionado à Apple Wallet!')}
                  className="w-full py-3 rounded-xl bg-black border border-white/20 text-white font-bold text-xs flex items-center justify-center gap-2 hover:bg-white/10 transition-colors"
                >
                  <Apple className="w-4 h-4" />
                  <span>Adicionar à Apple Wallet</span>
                </button>

                <button
                  type="button"
                  onClick={() => alert('Pass oficial adicionado ao Google Wallet!')}
                  className="w-full py-3 rounded-xl bg-[#1E1E24] border border-white/20 text-white font-bold text-xs flex items-center justify-center gap-2 hover:bg-white/15 transition-colors"
                >
                  <Smartphone className="w-4 h-4 text-[#FFC82C]" />
                  <span>Adicionar ao Google Wallet</span>
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
