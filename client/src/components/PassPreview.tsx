import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Smartphone, Apple } from 'lucide-react';

interface PassPreviewProps {
  storeName: string;
  customerName: string;
  stamps: number;
  required?: number;
  rewardLabel: string;
  cycle?: number;
  serial: string;
  backgroundColor?: string;
  foregroundColor?: string;
  labelColor?: string;
  accentColor?: string;
  stampIcon?: 'coin' | 'smile' | 'star' | 'coffee';
  defaultWallet?: 'apple' | 'google';
}

export const PassPreview: React.FC<PassPreviewProps> = ({
  storeName,
  customerName,
  stamps,
  required = 10,
  rewardLabel,
  cycle = 1,
  serial,
  backgroundColor = '#0F0F10',
  foregroundColor = '#FFFFFF',
  labelColor = '#8ABABF',
  accentColor = '#FFC82C',
  defaultWallet = 'apple'
}) => {
  const [walletType, setWalletType] = useState<'apple' | 'google'>(defaultWallet);
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (qrCanvasRef.current && serial) {
      QRCode.toCanvas(
        qrCanvasRef.current,
        serial,
        {
          width: 140,
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

  const isComplete = stamps >= 10;

  return (
    <div className="flex flex-col items-center select-none w-full max-w-[380px] mx-auto">
      {/* Wallet Switcher Tabs */}
      <div className="flex items-center gap-2 p-1 bg-white/5 border border-white/10 rounded-full mb-4">
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
          className="rounded-[24px] p-4 flex flex-col justify-between transition-colors duration-300 shadow-xl border border-white/10 overflow-hidden relative min-h-[500px]"
          style={{
            backgroundColor,
            color: foregroundColor
          }}
        >
          {/* Subtle shine background overlay */}
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/10 pointer-events-none" />

          {/* Header */}
          <div className="flex items-start justify-between relative z-10 border-b border-white/10 pb-3">
            <div>
              <span
                className="text-[10px] font-bold tracking-widest uppercase block"
                style={{ color: labelColor }}
              >
                CARTÃO DE FIDELIDADE
              </span>
              <h3 className="text-xl font-black tracking-tight" style={{ color: foregroundColor }}>
                {storeName}
              </h3>
            </div>
            <div className="text-right">
              <span
                className="text-[10px] font-bold tracking-widest uppercase block"
                style={{ color: labelColor }}
              >
                SALDO
              </span>
              <span
                className="text-2xl font-black tracking-tight"
                style={{ color: accentColor }}
              >
                {stamps} / {required}
              </span>
            </div>
          </div>

          {/* Customer & Info Banner */}
          <div className="grid grid-cols-2 gap-2 my-2 relative z-10">
            <div>
              <span className="text-[9px] font-bold tracking-wider uppercase block" style={{ color: labelColor }}>
                CLIENTE
              </span>
              <p className="text-sm font-semibold truncate" style={{ color: foregroundColor }}>
                {customerName || 'Cliente Convidado'}
              </p>
            </div>
            <div className="text-right">
              <span className="text-[9px] font-bold tracking-wider uppercase block" style={{ color: labelColor }}>
                CICLO ATUAL
              </span>
              <p className="text-sm font-bold" style={{ color: foregroundColor }}>
                #{cycle}
              </p>
            </div>
          </div>

          {/* 10-Stamps Strip Grid (Interactive Visual Representation) */}
          <div className="bg-black/40 backdrop-blur-md rounded-2xl p-3 my-2 border border-white/10 relative z-10">
            <div className="grid grid-cols-5 gap-2.5">
              {Array.from({ length: 10 }).map((_, index) => {
                const i = index + 1;
                const isFilled = i <= stamps;
                const is10th = i === 10;

                return (
                  <div
                    key={i}
                    className={`aspect-square rounded-full flex flex-col items-center justify-center relative transition-all duration-300 ${
                      isFilled
                        ? 'shadow-lg scale-100'
                        : is10th
                        ? 'border-2 border-dashed border-mimo-yellow/60 bg-mimo-yellow/10'
                        : 'border border-white/20 bg-white/5'
                    }`}
                    style={
                      isFilled
                        ? {
                            background: `linear-gradient(135deg, #FFE57F 0%, ${accentColor} 45%, #C9992E 100%)`,
                            boxShadow: `0 2px 10px ${accentColor}66`,
                            color: '#1a1300'
                          }
                        : {}
                    }
                  >
                    {isFilled ? (
                      <div className="flex flex-col items-center justify-center">
                        {/* Smile mascot / coin shape */}
                        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                          <circle cx="8.5" cy="9" r="1.5" />
                          <circle cx="15.5" cy="9" r="1.5" />
                          <path d="M7 13 Q12 18 17 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                      </div>
                    ) : is10th ? (
                      <span className="text-xs font-black text-mimo-yellow">★ 10</span>
                    ) : (
                      <span className="text-xs font-semibold opacity-40">{i}</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Status footer inside strip */}
            <div className="mt-2.5 text-center">
              {isComplete ? (
                <div className="bg-mimo-green text-white text-[11px] font-bold py-1 px-3 rounded-full inline-block animate-pulse shadow-md">
                  🎉 Recompensa Pronta: {rewardLabel}
                </div>
              ) : (
                <span className="text-[11px] font-medium" style={{ color: labelColor }}>
                  Faltam {Math.max(0, 10 - stamps)} selos para {rewardLabel}
                </span>
              )}
            </div>
          </div>

          {/* Barcode / QR Code Area */}
          <div className="bg-white rounded-2xl p-3 flex flex-col items-center justify-center text-center shadow-md relative z-10">
            <canvas ref={qrCanvasRef} className="w-28 h-28" />
            <span className="text-[10px] font-mono text-gray-700 tracking-wider mt-1 truncate max-w-full">
              {serial}
            </span>
            <span className="text-[9px] font-semibold text-gray-500 uppercase tracking-widest mt-0.5">
              Apresente ao pagar
            </span>
          </div>

          {/* Wallet footer branding */}
          <div className="mt-3 flex items-center justify-between text-[10px] relative z-10 opacity-70">
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
