import React from 'react';
import { resizeImageDataUrl } from './resizeImage.js';

/** Bloco de seção do editor, no estilo dos cards arredondados do painel. */
export const Section: React.FC<{
  step: number;
  title: string;
  icon?: React.ReactNode;
  badge?: string;
  children: React.ReactNode;
}> = ({ step, title, icon, badge, children }) => (
  <section className="surface-panel p-5 space-y-4">
    <header className="flex items-center justify-between gap-3 border-b border-border/60 pb-3">
      <div className="flex items-center gap-2.5 min-w-0">
        {icon && <span className="text-primary shrink-0">{icon}</span>}
        <h3 className="text-sm font-bold text-foreground truncate">
          {step}. {title}
        </h3>
      </div>
      {badge && (
        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-primary/15 text-primary border border-primary/25">
          {badge}
        </span>
      )}
    </header>
    {children}
  </section>
);

export const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({
  label,
  hint,
  children,
}) => (
  <div className="space-y-1.5">
    <label className="label-eyebrow block">{label}</label>
    {children}
    {hint && <p className="text-[11px] text-muted-foreground leading-snug">{hint}</p>}
  </div>
);

export const TextInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
  <input
    {...props}
    className={`w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-primary ${props.className || ''}`}
  />
);

export const ColorInput: React.FC<{ label: string; value: string; onChange: (v: string) => void }> = ({
  label,
  value,
  onChange,
}) => (
  <div className="space-y-1.5">
    <label className="label-eyebrow block">{label}</label>
    <div className="flex items-center gap-2 rounded-xl border border-input bg-background p-2">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-8 cursor-pointer rounded-lg border-0 bg-transparent p-0"
        aria-label={label}
      />
      <input
        type="text"
        value={value.toUpperCase()}
        onChange={(e) => {
          const v = e.target.value.trim();
          if (/^#[0-9a-fA-F]{0,6}$/.test(v)) onChange(v);
        }}
        className="w-full bg-transparent font-mono text-xs font-bold uppercase text-foreground outline-none"
      />
    </div>
  </div>
);

export const Toggle: React.FC<{
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}> = ({ checked, onChange, label, description }) => (
  <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/40 px-3.5 py-2.5">
    <div className="min-w-0">
      <div className="text-xs font-semibold text-foreground">{label}</div>
      {description && <div className="text-[11px] text-muted-foreground truncate">{description}</div>}
    </div>
    <button
      type="button"
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`relative h-6 w-11 shrink-0 rounded-full p-0.5 transition-colors ${
        checked ? 'bg-primary' : 'bg-white/15'
      }`}
    >
      <span
        className={`block h-5 w-5 rounded-full bg-background transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  </div>
);

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
              active
                ? 'border-primary bg-primary/15 text-primary'
                : 'border-border/60 bg-background/40 text-muted-foreground hover:text-foreground'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Botão de upload. A imagem é redimensionada para `maxSize` antes de virar
 * data URI — o design inteiro é salvo num único documento do Firestore
 * (teto de 1MB), então guardar o arquivo original estouraria o limite.
 */
export const ImageUpload: React.FC<{
  label: string;
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  accept?: string;
  maxMb?: number;
  /** Maior dimensão (px) com que a imagem é armazenada. */
  maxSize?: number;
  onError?: (msg: string) => void;
}> = ({
  label,
  value,
  onChange,
  accept = 'image/png,image/jpeg,image/svg+xml',
  maxMb = 4,
  maxSize = 256,
  onError,
}) => {
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > maxMb * 1024 * 1024) {
      onError?.(`Arquivo muito grande. Máximo ${maxMb}MB.`);
      return;
    }
    try {
      const dataUrl = await resizeImageDataUrl(file, maxSize);
      onChange(dataUrl);
    } catch (err: any) {
      onError?.(err?.message || 'Não foi possível processar a imagem.');
    } finally {
      // Permite reenviar o mesmo arquivo depois de remover
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="flex items-center gap-3">
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-border/60 bg-background/60 flex items-center justify-center">
        {value ? (
          <img src={value} alt={label} className="h-full w-full object-contain" />
        ) : (
          <span className="text-[10px] text-muted-foreground">vazio</span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="btn-mimo-ghost !py-2 !px-3.5 !text-xs"
        >
          {label}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="rounded-full border border-destructive/40 px-3 py-2 text-xs font-semibold text-destructive/90 transition-colors hover:bg-destructive/10"
          >
            Remover
          </button>
        )}
        <input ref={inputRef} type="file" accept={accept} onChange={handleFile} className="hidden" />
      </div>
    </div>
  );
};
