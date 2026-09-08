import React, { useState, useEffect } from 'react';
import { 
  Palette, Users, Download, 
  CheckCircle2, AlertTriangle, Sparkles, Sliders
} from 'lucide-react';
import { PassPreview } from '../components/PassPreview.js';
import * as mock from '../services/mockData.js';

export const StoreDashboard: React.FC = () => {
  const orgId = 'org_dessertclub';
  const [stats, setStats] = useState<mock.OrgStats | null>(null);
  const [designConfig, setDesignConfig] = useState({
    backgroundColor: '#0F0F10',
    foregroundColor: '#FFFFFF',
    labelColor: '#8ABABF',
    accentColor: '#FFC82C',
    rewardLabel: 'Cookie Grátis',
    stampIcon: 'coin' as const,
    showMimoBranding: true
  });

  const [previewStamps, setPreviewStamps] = useState(8);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'builder' | 'metrics' | 'export'>('builder');

  const getLuminance = (hex: string) => {
    const clean = hex.replace('#', '');
    if (clean.length !== 6) return 0;
    const r = parseInt(clean.substring(0, 2), 16) / 255;
    const g = parseInt(clean.substring(2, 4), 16) / 255;
    const b = parseInt(clean.substring(4, 6), 16) / 255;
    const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  };

  const l1 = getLuminance(designConfig.backgroundColor);
  const l2 = getLuminance(designConfig.foregroundColor);
  const contrastRatio = Number(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)).toFixed(2));
  const isContrastValid = contrastRatio >= 4.5;

  useEffect(() => {
    mock.fetchOrgStats(orgId).then(data => setStats(data));
  }, [orgId]);

  const handlePublish = async () => {
    if (!isContrastValid) {
      alert('Corrija o contraste antes de publicar.');
      return;
    }
    setIsPublishing(true);
    setPublishSuccess(null);
    await new Promise(resolve => setTimeout(resolve, 800));
    setPublishSuccess(`Design v2 publicado com sucesso para todos os cartões!`);
    setTimeout(() => setPublishSuccess(null), 5000);
    setIsPublishing(false);
  };

  const allCards = mock.getAllCards();

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 md:py-8 page-enter">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 md:mb-8">
        <div>
          <span className="text-xs font-bold tracking-widest text-mimo-yellow uppercase block mb-1">
            PAINEL DO LOJISTA • GESTÃO E IDENTIDADE
          </span>
          <h1 className="text-2xl md:text-4xl font-black text-white tracking-tight">
            {stats?.org?.publicName || 'Dessert Club'}
          </h1>
          <p className="text-sm text-white/60 mt-1 hidden md:block">
            Personalize a aparência do seu cartão e acompanhe o engajamento.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-white/5 border border-white/10 p-1 rounded-2xl w-full md:w-auto overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('builder')}
            className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'builder' ? 'bg-mimo-yellow text-black shadow-md' : 'text-white/70 hover:text-white'
            }`}
          >
            <Palette className="w-4 h-4" />
            Construtor
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('metrics')}
            className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'metrics' ? 'bg-mimo-yellow text-black shadow-md' : 'text-white/70 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            Clientes
          </button>
          <button
            type="button"
            onClick={() => {}}
            className="flex items-center gap-2 px-3 md:px-4 py-2 rounded-xl text-xs font-bold text-white/70 hover:text-white hover:bg-white/5 transition-all whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            CSV
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8 stagger-children">
        <div className="glass-panel p-4 md:p-5">
          <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-mimo-gray block">
            CLIENTES
          </span>
          <div className="text-2xl md:text-3xl font-black text-white mt-1">
            {stats?.counters?.customers ?? 3}
          </div>
          <span className="text-[10px] text-white/40 mt-1 block hidden md:inline">Base própria e exportável</span>
        </div>

        <div className="glass-panel p-4 md:p-5">
          <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-mimo-gray block">
            SELOS
          </span>
          <div className="text-2xl md:text-3xl font-black text-mimo-yellow mt-1">
            {stats?.counters?.stampsAllTime ?? 21}
          </div>
          <span className="text-[10px] text-white/40 mt-1 block hidden md:inline">Carimbos acumulados</span>
        </div>

        <div className="glass-panel p-4 md:p-5">
          <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-mimo-gray block">
            RECOMPENSAS
          </span>
          <div className="text-2xl md:text-3xl font-black text-mimo-green mt-1">
            {stats?.counters?.redemptionsAllTime ?? 1}
          </div>
          <span className="text-[10px] text-white/40 mt-1 block hidden md:inline">Ciclos concluídos</span>
        </div>

        <div className="glass-panel p-4 md:p-5">
          <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-mimo-gray block">
            RESGATE
          </span>
          <div className="text-2xl md:text-3xl font-black text-white mt-1">
            80%
          </div>
          <span className="text-[10px] text-mimo-green mt-1 block font-semibold hidden md:inline">Alto engajamento</span>
        </div>
      </div>

      {/* Tab: Card Builder */}
      {activeTab === 'builder' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* Controls */}
          <div className="lg:col-span-6 space-y-5 md:space-y-6">
            <div className="glass-panel p-5 md:p-6 space-y-5 animate-fade-in-up">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h2 className="text-base md:text-lg font-black text-white flex items-center gap-2">
                  <Palette className="w-5 h-5 text-mimo-yellow" />
                  Identidade do Cartão
                </h2>
                <span className="text-xs font-mono text-mimo-yellow bg-mimo-yellow/10 px-2.5 py-1 rounded-full">
                  v{stats?.stores?.[0]?.activeDesignVersion || 1}
                </span>
              </div>

              {publishSuccess && (
                <div className="bg-mimo-green/20 border border-mimo-green/50 p-3.5 rounded-xl text-white text-xs font-semibold flex items-center gap-2 animate-scale-in">
                  <CheckCircle2 className="w-4 h-4 text-mimo-green shrink-0" />
                  {publishSuccess}
                </div>
              )}

              {/* Reward Label */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-white/80 block mb-1.5">
                  Texto da Recompensa (10º Selo)
                </label>
                <input
                  type="text"
                  value={designConfig.rewardLabel}
                  onChange={(e) => setDesignConfig({ ...designConfig, rewardLabel: e.target.value })}
                  placeholder="Ex: Cookie Grátis"
                  className="input-mimo font-semibold"
                />
              </div>

              {/* Color Pickers */}
              <div className="grid grid-cols-2 gap-3 md:gap-4">
                {[
                  { key: 'backgroundColor', label: 'Cor de Fundo' },
                  { key: 'foregroundColor', label: 'Texto' },
                  { key: 'labelColor', label: 'Rótulos' },
                  { key: 'accentColor', label: 'Destaque' },
                ].map(item => (
                  <div key={item.key}>
                    <label className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-white/80 block mb-1.5">
                      {item.label}
                    </label>
                    <div className="flex items-center gap-2 bg-black/50 border border-white/15 rounded-xl p-2">
                      <input
                        type="color"
                        value={(designConfig as any)[item.key]}
                        onChange={(e) => setDesignConfig({ ...designConfig, [item.key]: e.target.value })}
                        className="w-7 h-7 md:w-8 md:h-8 rounded-lg cursor-pointer bg-transparent border-none"
                      />
                      <span className="font-mono text-[10px] md:text-xs text-white uppercase font-bold">
                        {(designConfig as any)[item.key]}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* WCAG Contrast */}
              <div
                className={`p-3.5 md:p-4 rounded-2xl border flex items-start gap-3 ${
                  isContrastValid
                    ? 'bg-mimo-green/10 border-mimo-green/30 text-white'
                    : 'bg-mimo-red/15 border-mimo-red/40 text-white'
                }`}
              >
                {isContrastValid ? (
                  <CheckCircle2 className="w-5 h-5 text-mimo-green shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-mimo-red shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold uppercase tracking-wider">
                      Contraste: {contrastRatio}:1
                    </span>
                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                        isContrastValid ? 'bg-mimo-green text-black' : 'bg-mimo-red text-white'
                      }`}
                    >
                      {isContrastValid ? '✓ APROVADO' : '✗ REPROVADO'}
                    </span>
                  </div>
                  <p className="text-[10px] md:text-xs text-white/70 mt-1">
                    {isContrastValid
                      ? 'Legibilidade excelente sob qualquer condição de luz.'
                      : 'Ajuste as cores para atingir contraste ≥ 4.5:1.'}
                  </p>
                </div>
              </div>

              {/* Stamp Preview Slider */}
              <div className="bg-black/30 border border-white/10 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold uppercase tracking-wider text-white/70 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-mimo-yellow" />
                    Simular Saldo
                  </span>
                  <span className="font-mono font-bold text-mimo-yellow">{previewStamps}/10</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={previewStamps}
                  onChange={(e) => setPreviewStamps(parseInt(e.target.value, 10))}
                  className="w-full accent-mimo-yellow cursor-pointer"
                />
              </div>

              {/* Publish Button */}
              <button
                type="button"
                onClick={handlePublish}
                disabled={!isContrastValid || isPublishing}
                className="btn-mimo-primary w-full py-3.5 md:py-4 text-sm md:text-base font-bold shadow-xl"
              >
                <Sparkles className="w-5 h-5" />
                {isPublishing ? 'Publicando...' : 'Publicar Design Oficial'}
              </button>
            </div>
          </div>

          {/* Pass Preview */}
          <div className="lg:col-span-6 flex flex-col items-center">
            <div className="text-center mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-mimo-gray">
                SIMULAÇÃO EM TEMPO REAL
              </span>
            </div>

            <PassPreview
              storeName={stats?.org?.publicName || 'Dessert Club'}
              customerName="Maria Silva"
              stamps={previewStamps}
              rewardLabel={designConfig.rewardLabel}
              serial="8f3a-92bc-41de-aa22"
              backgroundColor={designConfig.backgroundColor}
              foregroundColor={designConfig.foregroundColor}
              labelColor={designConfig.labelColor}
              accentColor={designConfig.accentColor}
            />
          </div>
        </div>
      ) : (
        /* Tab: Metrics & CRM */
        <div className="glass-panel p-4 md:p-6 space-y-5 md:space-y-6 animate-fade-in-up">
          <div className="flex items-center justify-between">
            <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-mimo-yellow" />
              Base de Clientes
            </h2>
            <span className="text-xs text-white/50">
              Dados isolados da sua organização
            </span>
          </div>

          <div className="overflow-x-auto -mx-4 md:mx-0">
            <table className="w-full text-left text-sm text-white/80 border-collapse min-w-[600px]">
              <thead>
                <tr className="border-b border-white/10 text-xs font-bold uppercase tracking-wider text-white/50">
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">E-mail</th>
                  <th className="py-3 px-4">Selos</th>
                  <th className="py-3 px-4">Ciclo</th>
                  <th className="py-3 px-4">Serial</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {allCards.map((card) => (
                  <tr key={card.serial} className="hover:bg-white/5 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-white">{card.customer.name}</td>
                    <td className="py-3.5 px-4 font-mono text-xs">{card.customer.email_masked}</td>
                    <td className="py-3.5 px-4">
                      <span className={`font-bold px-2 py-0.5 rounded-full text-xs ${
                        card.stamps >= 10
                          ? 'bg-mimo-green/15 text-mimo-green'
                          : 'bg-mimo-yellow/15 text-mimo-yellow'
                      }`}>
                        {card.stamps}/10
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-bold">#{card.cycle}</td>
                    <td className="py-3.5 px-4 font-mono text-xs text-white/50">{card.serial}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
