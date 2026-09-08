import React, { useState } from 'react';
import { 
  Palette, ChevronRight, Sliders, CheckCircle2, 
  AlertTriangle, Sparkles, Smartphone, Apple, Eye, RefreshCw
} from 'lucide-react';
import { PassPreview } from '../components/PassPreview.js';

interface CardDesignerProps {
  onBackToCards: () => void;
}

export const CardDesigner: React.FC<CardDesignerProps> = ({ onBackToCards }) => {
  const [storeName, setStoreName] = useState('NOX Dessert Club');
  const [rewardLabel, setRewardLabel] = useState('Cookie Grátis');
  const [backgroundColor, setBackgroundColor] = useState('#0F0F10');
  const [foregroundColor, setForegroundColor] = useState('#FFFFFF');
  const [labelColor, setLabelColor] = useState('#8ABABF');
  const [accentColor, setAccentColor] = useState('#FFC82C');
  const [previewStamps, setPreviewStamps] = useState(8);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Luminance & WCAG contrast calculation
  const getLuminance = (hex: string) => {
    const clean = hex.replace('#', '');
    if (clean.length !== 6) return 0;
    const r = parseInt(clean.substring(0, 2), 16) / 255;
    const g = parseInt(clean.substring(2, 4), 16) / 255;
    const b = parseInt(clean.substring(4, 6), 16) / 255;
    const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  };

  const l1 = getLuminance(backgroundColor);
  const l2 = getLuminance(foregroundColor);
  const contrastRatio = Number(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)).toFixed(2));
  const isContrastValid = contrastRatio >= 4.5;

  const handleSave = async () => {
    if (!isContrastValid) {
      alert('Corrija o contraste antes de publicar.');
      return;
    }
    setIsSaving(true);
    await new Promise(r => setTimeout(r, 600));
    setIsSaving(false);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 4000);
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium mb-1">
            <span>Início</span>
            <ChevronRight className="w-3.5 h-3.5" />
            <button 
              type="button" 
              onClick={onBackToCards}
              className="text-slate-500 hover:text-slate-800 underline"
            >
              Gerenciar cartões
            </button>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-slate-700 font-semibold">Designer de Cartão</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Personalizar Identidade do Cartão
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBackToCards}
            className="btn-outline-subtle text-xs"
          >
            Voltar aos Cartões
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!isContrastValid || isSaving}
            className="btn-primary-teal text-xs font-bold py-2.5 px-4"
          >
            {isSaving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            <span>{isSaving ? 'Publicando...' : 'Publicar Design Oficial'}</span>
          </button>
        </div>
      </div>

      {savedSuccess && (
        <div className="bg-emerald-50 border border-emerald-300 p-4 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Design v2 atualizado e sincronizado com a Apple e Google Wallet com sucesso!</span>
        </div>
      )}

      {/* Main Grid: Controls & Phone Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Controls Column */}
        <div className="lg:col-span-6 space-y-6">
          <div className="saas-card p-6 space-y-5">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <Palette className="w-4 h-4 text-teal-600" />
              <span>Configurações Visuais</span>
            </h3>

            {/* Store Name */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block mb-1.5">
                Nome da Loja no Cartão
              </label>
              <input
                type="text"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="input-saas font-semibold"
              />
            </div>

            {/* Reward Title */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block mb-1.5">
                Texto da Recompensa (10º Selo)
              </label>
              <input
                type="text"
                value={rewardLabel}
                onChange={(e) => setRewardLabel(e.target.value)}
                placeholder="Ex: Cookie Grátis, Café Especial..."
                className="input-saas font-semibold"
              />
            </div>

            {/* Color Pickers Grid */}
            <div className="grid grid-cols-2 gap-4 pt-2">
              {[
                { label: 'Cor de Fundo', val: backgroundColor, set: setBackgroundColor },
                { label: 'Texto Principal', val: foregroundColor, set: setForegroundColor },
                { label: 'Rótulos e Subtítulos', val: labelColor, set: setLabelColor },
                { label: 'Destaque e Selos', val: accentColor, set: setAccentColor },
              ].map((c) => (
                <div key={c.label} className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase block">
                    {c.label}
                  </label>
                  <div className="flex items-center gap-2 p-2 border border-slate-200 rounded-xl bg-slate-50">
                    <input
                      type="color"
                      value={c.val}
                      onChange={(e) => c.set(e.target.value)}
                      className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                    />
                    <span className="font-mono text-xs font-bold text-slate-700 uppercase">
                      {c.val}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* WCAG Contrast Verification Box */}
            <div
              className={`p-4 rounded-xl border flex items-start gap-3 ${
                isContrastValid
                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50/70 border-rose-200 text-rose-900'
              }`}
            >
              {isContrastValid ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider">
                    Contraste WCAG: {contrastRatio}:1
                  </span>
                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                      isContrastValid
                        ? 'bg-emerald-200 text-emerald-900'
                        : 'bg-rose-200 text-rose-900'
                    }`}
                  >
                    {isContrastValid ? '✓ APROVADO' : '✗ REPROVADO'}
                  </span>
                </div>
                <p className="text-xs mt-1 text-slate-600 leading-relaxed">
                  {isContrastValid
                    ? 'Excelente legibilidade sob qualquer nível de iluminação ou modo escuro.'
                    : 'Ajuste a cor de fundo e do texto para alcançar contraste mínimo de 4.5:1.'}
                </p>
              </div>
            </div>

            {/* Stamp count preview slider */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-teal-600" />
                  Simular Selos Acumulados no Celular
                </span>
                <span className="font-mono font-bold text-teal-700 bg-teal-100/60 px-2 py-0.5 rounded">
                  {previewStamps} / 10
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                value={previewStamps}
                onChange={(e) => setPreviewStamps(parseInt(e.target.value, 10))}
                className="w-full accent-teal-600 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Live Smartphone Wallet Preview Column */}
        <div className="lg:col-span-6 flex flex-col items-center">
          <div className="text-center mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Visualização Fiel na Carteira Digital
            </span>
          </div>

          <PassPreview
            storeName={storeName}
            customerName="Maria Silva"
            stamps={previewStamps}
            rewardLabel={rewardLabel}
            serial="8f3a-92bc-41de-aa22"
            backgroundColor={backgroundColor}
            foregroundColor={foregroundColor}
            labelColor={labelColor}
            accentColor={accentColor}
          />
        </div>
      </div>
    </div>
  );
};
