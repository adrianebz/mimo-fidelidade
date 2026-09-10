import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Smartphone, Apple, Sparkles } from 'lucide-react';

interface PassPreviewProps {
  storeName: string;
  customerName: string;
  stamps: number;
  required?: number;
  rewardLabel: string;
  rewardDescription?: string;
  cycle?: number;
  serial: string;
  backgroundColor?: string;
  foregroundColor?: string;
  labelColor?: string;
  accentColor?: string;
  stampIcon?: 'coin' | 'smile' | 'star' | 'coffee' | 'cookie' | 'heart' | 'sparkle' | 'fire';
  stampImage?: string | null;
  rewardStampImage?: string | null;
  storeLogoImage?: string | null;
  defaultWallet?: 'apple' | 'google';
}

export const PassPreview: React.FC<PassPreviewProps> = ({
  storeName,
  customerName,
  stamps,
  required = 10,
  rewardLabel,
  rewardDescription,
  cycle = 1,
  serial,
  backgroundColor = '#141416',
  foregroundColor = '#FFFFFF',
  labelColor = '#9CA3AF',
  accentColor = '#FFC82C',
  stampIcon = 'cookie',
  stampImage,
  rewardStampImage,
  storeLogoImage,
  defaultWallet = 'google'
}) => {
  const [walletType, setWalletType] = useState<'apple' | 'google'>(defaultWallet);
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (qrCanvasRef.current && serial) {
      QRCode.toCanvas(
        qrCanvasRef.current,
        serial,
        {
          width: 130,
          margin: 1,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        },
        (error) => {
          if (error) console.error('QR render error:', error);
        }
      );
    }
  }, [serial, walletType]);

  const isComplete = stamps >= required;

  return (
    <div className="flex flex-col items-center select-none w-full max-w-[390px] mx-auto">
      {/* Wallet Switcher Tabs */}
      <div className="flex items-center gap-2 p-1 bg-white/5 border border-white/10 rounded-full mb-4">
        <button
          type="button"
          onClick={() => setWalletType('google')}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
            walletType === 'google'
              ? 'bg-white text-black shadow-md'
              : 'text-white/70 hover:text-white'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5" />
          Google Wallet
        </button>
        <button
          type="button"
          onClick={() => setWalletType('apple')}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
            walletType === 'apple'
              ? 'bg-white text-black shadow-md'
              : 'text-white/70 hover:text-white'
          }`}
        >
          <Apple className="w-3.5 h-3.5" />
          Apple Wallet
        </button>
      </div>

      {/* Realistic Smartphone Shell */}
      <div
        className="w-full relative rounded-[40px] p-3 shadow-2xl border-4 transition-all duration-300"
        style={{
          backgroundColor: '#000000',
          borderColor: '#26262b'
        }}
      >
        {/* Dynamic Island / Camera Notch */}
        <div className="w-24 h-5 bg-black rounded-full mx-auto mb-3 flex items-center justify-end px-3">
          <div className="w-2.5 h-2.5 rounded-full bg-[#0d0d10] border border-[#1f1f26]"></div>
        </div>

        {/* Digital Pass Card */}
        <div
          className="rounded-[24px] p-4 sm:p-5 flex flex-col justify-between transition-colors duration-300 shadow-xl border border-white/10 overflow-hidden relative min-h-[520px]"
          style={{
            backgroundColor,
            color: foregroundColor
          }}
        >
          {/* Subtle shine background overlay */}
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/10 pointer-events-none" />

          {/* Header com Logo e Nome da Loja */}
          <div className="flex items-start justify-between relative z-10 border-b border-white/10 pb-3">
            <div className="flex items-center gap-2.5">
              {storeLogoImage ? (
                <div className="h-10 w-10 rounded-xl bg-black/40 border border-white/20 p-1 flex items-center justify-center overflow-hidden shrink-0 shadow-md">
                  <img src={storeLogoImage} alt="Logo" className="h-full w-full object-contain" />
                </div>
              ) : (
                <div
                  className="h-10 w-10 rounded-xl flex items-center justify-center text-lg shadow-inner font-bold shrink-0"
                  style={{ backgroundColor: `${accentColor}25`, color: accentColor }}
                >
                  🏪
                </div>
              )}
              <div>
                <h3 className="text-base font-black tracking-tight leading-tight" style={{ color: foregroundColor }}>
                  {storeName || 'Nome da Loja'}
                </h3>
                <span className="text-[10px] font-bold tracking-wider uppercase block opacity-70" style={{ color: labelColor }}>
                  CARTÃO DE FIDELIDADE
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[9px] font-bold tracking-widest uppercase block opacity-70" style={{ color: labelColor }}>
                STATUS
              </span>
              <span className="text-xs font-semibold text-emerald-400">
                Ativo
              </span>
            </div>
          </div>

          {/* Customer & Info Banner */}
          <div className="grid grid-cols-2 gap-2 my-2.5 relative z-10 border-b border-white/5 pb-2.5">
            <div>
              <span className="text-[9px] font-bold tracking-wider uppercase block" style={{ color: labelColor }}>
                CLIENTE VIP
              </span>
              <p className="text-xs sm:text-sm font-bold truncate" style={{ color: foregroundColor }}>
                {customerName || 'Cliente Convidado'}
              </p>
            </div>
            <div className="text-right">
              <span className="text-[9px] font-bold tracking-wider uppercase block" style={{ color: labelColor }}>
                PROGRESSO
              </span>
              <span className="text-xs sm:text-sm font-black" style={{ color: accentColor }}>
                {stamps} / {required} SELOS
              </span>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              CARTELA DE SELOS GOOGLE WALLET (2x5 GRID CIRCULAR)
             ═══════════════════════════════════════════════════════════════ */}
          <div className="bg-[#18181b] rounded-2xl p-3.5 sm:p-4 my-2 border border-white/10 relative z-10 shadow-inner">
            <div className="grid grid-cols-5 gap-2 sm:gap-2.5 justify-items-center">
              {Array.from({ length: 10 }).map((_, index) => {
                const i = index + 1;
                const isFilled = i <= stamps;
                const is10th = i === 10;

                if (is10th) {
                  // 10º Selo: Selo Especial do Prêmio com Estrela Dourada
                  return (
                    <div key={i} className="relative flex items-center justify-center">
                      <div className="absolute -top-1 -right-1 z-10 w-4 h-4 rounded-full bg-white text-amber-500 flex items-center justify-center text-[9px] shadow-md font-bold leading-none border border-amber-200">
                        ⭐
                      </div>
                      <div
                        className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center p-1 shadow-lg transition-transform ${
                          isFilled
                            ? 'bg-[#FFC82C] text-black shadow-amber-400/40 ring-2 ring-amber-300 scale-105'
                            : 'bg-[#FFC82C] text-black shadow-amber-400/20 border-2 border-amber-300/80'
                        }`}
                      >
                        {rewardStampImage ? (
                          <img src={rewardStampImage} alt="Prêmio" className="w-full h-full object-contain rounded-full" />
                        ) : (
                          <span className="text-[7px] sm:text-[7.5px] font-black uppercase text-center leading-[1.05] tracking-tight text-zinc-950 line-clamp-3 select-none px-0.5">
                            {rewardLabel || 'BROWNIE COOKIE GRÁTIS'}
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
                      key={i}
                      className="w-10 h-10 sm:w-11 sm:h-11 rounded-full p-[2px] bg-gradient-to-b from-[#FFE57F] via-[#F59E0B] to-[#92400E] shadow-md shadow-amber-500/25 flex items-center justify-center transition-transform"
                    >
                      <div className="w-full h-full rounded-full bg-gradient-to-tr from-[#78350F] via-[#B45309] to-[#D97706] border border-[#FEF3C7]/50 flex items-center justify-center text-amber-100 shadow-inner overflow-hidden">
                        {stampImage ? (
                          <img src={stampImage} alt="Selo" className="w-full h-full object-cover rounded-full" />
                        ) : stampIcon === 'cookie' ? (
                          <span className="text-base select-none filter drop-shadow">🍪</span>
                        ) : stampIcon === 'coffee' ? (
                          <span className="text-base select-none filter drop-shadow">☕</span>
                        ) : stampIcon === 'star' ? (
                          <span className="text-base select-none filter drop-shadow">⭐</span>
                        ) : stampIcon === 'heart' ? (
                          <span className="text-base select-none filter drop-shadow">❤️</span>
                        ) : stampIcon === 'sparkle' ? (
                          <span className="text-base select-none filter drop-shadow">✨</span>
                        ) : stampIcon === 'fire' ? (
                          <span className="text-base select-none filter drop-shadow">🔥</span>
                        ) : stampIcon === 'coin' ? (
                          <span className="text-base select-none filter drop-shadow">🪙</span>
                        ) : (
                          <span className="text-xs font-black text-amber-100">★</span>
                        )}
                      </div>
                    </div>
                  );
                }

                // Selos 1 a 9 Vazios
                return (
                  <div
                    key={i}
                    className="w-10 h-10 sm:w-11 sm:h-11 rounded-full border border-white/15 bg-white/5 flex items-center justify-center transition-all"
                  >
                    <span className="text-[10px] font-semibold text-white/20 select-none">
                      {i}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              CARDS INFORMATIVOS GOOGLE WALLET
             ═══════════════════════════════════════════════════════════════ */}
          <div className="space-y-1.5 relative z-10 text-left my-1">
            {/* Card 1: Stamps */}
            <div className="bg-[#242428] rounded-xl p-2.5 sm:p-3 border border-white/5">
              <span className="text-[10px] text-zinc-400 font-medium block">Stamps</span>
              <p className="text-xs font-semibold text-white mt-0.5 leading-snug">
                {rewardDescription || 'Here you will see your of stamps'}
              </p>
            </div>

            {/* Card 2: Selos */}
            <div className="bg-[#242428] rounded-xl p-2.5 sm:p-3 border border-white/5 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-zinc-400 font-medium block">Selos</span>
                <p className="text-xs font-bold text-white mt-0.5">
                  {stamps}/{required}
                </p>
              </div>
              <span className="text-[9px] font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20 uppercase tracking-wider">
                {walletType === 'google' ? 'Google Wallet' : 'Apple Wallet'}
              </span>
            </div>
          </div>

          {/* Barcode / QR Code Area */}
          <div className="bg-white rounded-xl p-2.5 flex flex-col items-center justify-center text-center shadow-md relative z-10 my-1">
            <canvas ref={qrCanvasRef} className="w-24 h-24" />
            <span className="text-[9px] font-mono text-gray-700 tracking-wider mt-0.5 truncate max-w-full">
              {serial}
            </span>
            <span className="text-[8px] font-semibold text-gray-500 uppercase tracking-widest">
              Apresente ao pagar
            </span>
          </div>

          {/* Wallet footer branding */}
          <div className="mt-1 flex items-center justify-between text-[9px] relative z-10 opacity-70">
            <span style={{ color: labelColor }}>Fidelidade por Mimo</span>
            <span className="font-semibold uppercase tracking-wider" style={{ color: foregroundColor }}>
              {walletType === 'apple' ? 'Apple Wallet' : 'Google Wallet'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
