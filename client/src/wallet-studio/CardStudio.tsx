import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Sparkles, RefreshCw, CheckCircle2, AlertTriangle, Download, RotateCcw } from 'lucide-react';
import type { CardDesign, CardHolderData } from './types.js';
import { createDefaultDesign } from './defaults.js';
import { loadDesign, publishDesign, saveDraft } from './designStorage.js';
import { PreviewPane } from './PreviewPane.js';
import {
  BrandSection,
  ColorsSection,
  StampsSection,
  RewardSection,
  FieldsSection,
  QrSection,
} from './EditorSections.js';

interface CardStudioProps {
  slug: string;
  /** Bloqueia a publicação (ex.: lojista inadimplente). */
  readOnlyReason?: string | null;
  onToast?: (message: string) => void;
}

function makeSampleHolder(design: CardDesign): CardHolderData {
  return {
    nome: 'Marina Azevedo',
    selos: Math.min(8, design.stamps.total),
    cartaoId: 'demo_5511999998888_1',
    passCode: 'MIMO-PASS-MA01',
    unidade: design.fields.unidade.value || 'Matriz',
    status: 'Ativo',
  };
}

/**
 * Estúdio de cartões: editor à esquerda, prévia viva à direita.
 *
 * Tudo o que o lojista configura vira um único JSON (CardDesign) que é salvo
 * no Firestore e consumido tanto pela prévia quanto pela geração real do passe
 * na Apple Wallet e na Google Wallet.
 */
export const CardStudio: React.FC<CardStudioProps> = ({ slug, readOnlyReason, onToast }) => {
  const [design, setDesign] = useState<CardDesign>(() => createDefaultDesign());
  const [holder, setHolder] = useState<CardHolderData>(() => makeSampleHolder(createDefaultDesign()));
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [banner, setBanner] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadDesign(slug)
      .then((loaded) => {
        if (cancelled) return;
        setDesign(loaded);
        setHolder(makeSampleHolder(loaded));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const patch = useCallback(
    (partial: Partial<CardDesign>) => {
      setDesign((prev) => {
        const next = { ...prev, ...partial };
        saveDraft(slug, next);
        return next;
      });
      setDirty(true);
      setBanner(null);
    },
    [slug]
  );

  // Mantém a simulação coerente quando a meta de selos muda
  useEffect(() => {
    setHolder((prev) => ({ ...prev, selos: Math.min(prev.selos, design.stamps.total) }));
  }, [design.stamps.total]);

  const handlePublish = async () => {
    if (readOnlyReason) {
      onToast?.(readOnlyReason);
      return;
    }
    setPublishing(true);
    setBanner(null);
    try {
      const res = await publishDesign(slug, design);
      setDesign(res.design);
      setDirty(false);
      const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      setBanner({
        kind: 'ok',
        text: `Cartão "${res.design.brand.storeName}" publicado às ${hora}. Os cartões já emitidos são atualizados automaticamente.`,
      });
      onToast?.('🎉 Cartão publicado nas carteiras digitais!');
    } catch (err: any) {
      setBanner({ kind: 'error', text: err?.message || 'Não foi possível publicar. Tente novamente.' });
    } finally {
      setPublishing(false);
    }
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(design, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mimo-cartao-${slug}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    const fresh = createDefaultDesign(design.brand.storeName);
    setDesign(fresh);
    saveDraft(slug, fresh);
    setDirty(true);
  };

  const sectionProps = useMemo(
    () => ({ design, patch, onError: (msg: string) => onToast?.(msg) }),
    [design, patch, onToast]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-6 w-6 animate-spin text-primary" />
          <span className="text-xs font-semibold text-muted-foreground">Carregando o cartão da loja…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Barra de ações */}
      <div className="flex flex-col gap-3 border-b border-border/60 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="label-eyebrow text-primary">Estúdio de Cartões Mimo</span>
          <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Identidade do Cartão de Fidelidade
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Personalize e publique — sem escrever uma linha de código.
            {dirty && <span className="ml-1.5 font-semibold text-primary">Alterações não publicadas</span>}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={handleReset} className="btn-mimo-ghost !py-2.5 !px-4 !text-xs">
            <RotateCcw className="h-3.5 w-3.5" />
            Restaurar padrão
          </button>
          <button type="button" onClick={handleExportJson} className="btn-mimo-ghost !py-2.5 !px-4 !text-xs">
            <Download className="h-3.5 w-3.5" />
            Exportar JSON
          </button>
          <button
            type="button"
            onClick={handlePublish}
            disabled={publishing || !!readOnlyReason}
            className="btn-mimo !py-2.5 !px-5 !text-xs disabled:opacity-50"
          >
            {publishing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {publishing ? 'Publicando…' : 'Publicar nas Carteiras'}
          </button>
        </div>
      </div>

      {readOnlyReason && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs font-semibold text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{readOnlyReason}</span>
        </div>
      )}

      {banner && (
        <div
          className={`flex items-start gap-2.5 rounded-xl border p-3.5 text-xs font-semibold ${
            banner.kind === 'ok'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
          }`}
        >
          {banner.kind === 'ok' ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span>{banner.text}</span>
        </div>
      )}

      {/* Editor + Prévia */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-7">
          <BrandSection {...sectionProps} />
          <ColorsSection {...sectionProps} />
          <StampsSection {...sectionProps} />
          <RewardSection {...sectionProps} />
          <FieldsSection {...sectionProps} />
          <QrSection {...sectionProps} />
        </div>

        <div className="lg:col-span-5">
          <div className="lg:sticky lg:top-6">
            <PreviewPane design={design} holder={holder} onHolderChange={setHolder} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CardStudio;
