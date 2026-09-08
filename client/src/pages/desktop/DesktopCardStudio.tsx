import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { 
  Palette, Sparkles, CheckCircle2, Sliders, 
  Smartphone, Apple, ShieldCheck, RefreshCw, Eye
} from 'lucide-react';

export const DesktopCardStudio: React.FC = () => {
  const [storeName, setStoreName] = useState('Minha Loja');
  const [headline, setHeadline] = useState('Fidelidade Mimo');
  const [rewardLabel, setRewardLabel] = useState('1 Produto Grátis');
  const [rewardTitle, setRewardTitle] = useState('1 Produto Grátis');
  const [stampsGoal, setStampsGoal] = useState(10);
  const [stampIcon, setStampIcon] = useState('coffee');
  const [paletteId, setPaletteId] = useState('warm-terracotta');
  const [customHex, setCustomHex] = useState('#B85D19');
  const [textColor, setTextColor] = useState('#FFFFFF');
  const [currentPassToken, setCurrentPassToken] = useState(
    'mimo-pass-minha-loja-8f3a',
  );
  const [stampCount, setStampCount] = useState(8);
  const [isActive, setIsActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (qrCanvasRef.current) {
      QRCode.toCanvas(
        qrCanvasRef.current,
        currentPassToken,
        {
          width: 140,
          margin: 1,
          color: { dark: '#0F0F10', light: '#FFFFFF' }
        },
        (err) => { if (err) console.error(err); }
      );
    }
  }, []);

  const handlePublish = async () => {
    setIsSaving(true);
    await new Promise(r => setTimeout(r, 600));
    setIsSaving(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 4000);
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/8 pb-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Criador de Cartão
          </h1>
          <p className="text-xs text-white/50 mt-0.5">
            Configure o design do cartão que aparecerá na Apple Wallet e Google Wallet dos clientes
          </p>
        </div>

        <button
          type="button"
          onClick={handlePublish}
          disabled={isSaving}
          className="btn-mimo-yellow text-xs font-bold py-2.5 px-4 flex items-center gap-2"
        >
          {isSaving ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          <span>{isSaving ? 'Publicando...' : 'Publicar Design do Cartão'}</span>
        </button>
      </div>

      {saveSuccess && (
        <div className="p-3.5 bg-emerald-500/15 border border-emerald-500/40 rounded-xl text-emerald-400 text-xs font-bold flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>Design do cartão publicado com sucesso para todos os clientes ativos!</span>
        </div>
      )}

      {/* 2-Column Grid (Matching Screen 4) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Configuration Form (50%) */}
        <div className="lg:col-span-6 mimo-card p-6 space-y-5">
          <h3 className="text-base font-bold text-white border-b border-white/8 pb-3 flex items-center gap-2">
            <Palette className="w-4 h-4 text-[#FFC82C]" />
            <span>Configurações do Cartão</span>
          </h3>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-white/70 block mb-1.5">
              Nome do Estabelecimento
            </label>
            <input
              type="text"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              className="input-mimo-dark font-semibold"
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-white/70 block mb-1.5">
              Recompensa do 10º Selo
            </label>
            <input
              type="text"
              value={rewardLabel}
              onChange={(e) => setRewardLabel(e.target.value)}
              placeholder="Ex: 1 Café Espresso Grátis"
              className="input-mimo-dark font-semibold"
            />
          </div>

          <div className="p-4 bg-black/40 rounded-xl border border-white/8 space-y-2">
            <span className="text-xs font-bold text-white block">
              Mecânica Oficial do Programa
            </span>
            <p className="text-xs text-white/60 leading-relaxed">
              <strong>10 selos = 1 recompensa</strong>. O cliente acumula selos a cada visita e ao completar 10 selos, a recompensa é liberada para resgate imediato no balcão.
            </p>
          </div>

          {/* Stamp Preview Slider */}
          <div className="p-4 bg-black/40 rounded-xl border border-white/8 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-white/80 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-[#FFC82C]" />
                Simular Selos no Mockup
              </span>
              <span className="font-mono font-bold text-[#FFC82C] bg-[#FFC82C]/15 px-2 py-0.5 rounded">
                {stampCount} / 10 Selos
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="10"
              value={stampCount}
              onChange={(e) => setStampCount(parseInt(e.target.value, 10))}
              className="w-full accent-[#FFC82C] cursor-pointer"
            />
          </div>

          {/* Toggle: Programa Ativo */}
          <div className="flex items-center justify-between p-4 bg-black/40 rounded-xl border border-white/8">
            <div>
              <span className="text-xs font-bold text-white block">
                Ativar na Apple Wallet & Google Wallet
              </span>
              <span className="text-[11px] text-white/50">
                Gera passes assinados com push automático
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsActive(!isActive)}
              className={`w-12 h-6 rounded-full transition-colors relative p-0.5 ${
                isActive ? 'bg-[#FFC82C]' : 'bg-white/20'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-black transition-transform ${
                  isActive ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <button
            type="button"
            onClick={handlePublish}
            disabled={isSaving}
            className="btn-mimo-yellow w-full text-xs font-bold py-3.5"
          >
            Publicar Design do Cartão
          </button>
        </div>

        {/* Right: Realistic Digital Pass Mockup (Matching Screen 4) */}
        <div className="lg:col-span-6 flex flex-col items-center">
          <div className="text-center mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-white/50">
              Pré-visualização do Cartão na Carteira
            </span>
          </div>

          {/* Digital Card Pass */}
          <div className="w-full max-w-[340px] bg-[#16161A] border-2 border-[#2E2E38] rounded-[28px] p-5 text-white shadow-2xl space-y-4 relative overflow-hidden">
            {/* Top Brand & Name */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#FFC82C] text-black font-black flex items-center justify-center text-xs">
                  P
                </div>
                <div>
                  <h4 className="text-xs font-black text-white leading-tight">
                    {storeName}
                  </h4>
                  <span className="text-[9px] text-[#FFC82C] font-bold uppercase tracking-wider">
                    Cartão Fidelidade
                  </span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[9px] text-white/40 uppercase block font-mono">SALDO</span>
                <span className="text-xs font-black text-[#FFC82C] font-mono">
                  {stampCount}/10
                </span>
              </div>
            </div>

            {/* 10-Stamp Grid */}
            <div className="grid grid-cols-5 gap-2 my-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
                const isStamped = num <= stampCount;
                return (
                  <div
                    key={num}
                    className={`aspect-square rounded-full flex items-center justify-center transition-all ${
                      isStamped
                        ? 'bg-[#FFC82C] text-black shadow-md shadow-[#FFC82C]/30 border-2 border-[#FFE28A]'
                        : 'bg-white/5 border border-dashed border-white/20 text-white/20 text-[10px]'
                    }`}
                  >
                    {isStamped ? (
                      num === 10 ? '🎁' : '🪙'
                    ) : (
                      num
                    )}
                  </div>
                );
              })}
            </div>

            {/* Reward Subtitle */}
            <div className="p-3 bg-black/40 rounded-xl border border-white/8 text-center space-y-0.5">
              <span className="text-[9px] text-[#FFC82C] font-bold uppercase tracking-wider block">
                RECOMPENSA DO 10º SELO
              </span>
              <p className="text-xs font-black text-white">
                {rewardLabel}
              </p>
            </div>

            {/* White QR Code at bottom (Matching Screen 4) */}
            <div className="pt-2 flex flex-col items-center">
              <div className="bg-white p-2.5 rounded-xl shadow-md inline-block">
                <canvas ref={qrCanvasRef} className="w-28 h-28 mx-auto" />
              </div>
              <span className="font-mono text-[10px] text-white/40 tracking-wider mt-2">
                SERIAL: 8F3A-92BC-41DE
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
