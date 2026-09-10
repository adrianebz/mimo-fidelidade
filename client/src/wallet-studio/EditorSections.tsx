import React from 'react';
import { Store, Palette, Grid3x3, Gift, ListChecks, QrCode } from 'lucide-react';
import type { CardDesign, InfoFieldsConfig, StampIconKey } from './types.js';
import { PALETTES, STAMP_ICON_CATALOG, STAMP_TOTAL_OPTIONS } from './defaults.js';
import { Section, Field, TextInput, ColorInput, Toggle, Segmented, ImageUpload } from './ui.js';
import { StampGlyph } from './StampGlyph.js';

type Patch = (patch: Partial<CardDesign>) => void;

interface SectionProps {
  design: CardDesign;
  patch: Patch;
  onError?: (msg: string) => void;
}

/** Seletor de ícone reutilizado pelo selo e pela recompensa. */
const IconPicker: React.FC<{
  value: StampIconKey;
  onChange: (v: StampIconKey) => void;
  accent: string;
}> = ({ value, onChange, accent }) => (
  <div className="flex flex-wrap gap-2">
    {STAMP_ICON_CATALOG.map((item) => {
      const active = item.key === value;
      return (
        <button
          key={item.key}
          type="button"
          onClick={() => onChange(item.key)}
          title={item.label}
          className={`flex h-14 w-14 flex-col items-center justify-center gap-1 rounded-xl border transition-colors ${
            active ? 'border-primary bg-primary/15' : 'border-border/60 bg-background/40 hover:border-border'
          }`}
        >
          <StampGlyph icon={item.key} color={active ? accent : '#9CA3AF'} size={22} />
          <span className={`text-[9px] font-semibold ${active ? 'text-primary' : 'text-muted-foreground'}`}>
            {item.label}
          </span>
        </button>
      );
    })}
  </div>
);

// ── 1. Marca ────────────────────────────────────────────────────────────────
export const BrandSection: React.FC<SectionProps> = ({ design, patch, onError }) => (
  <Section step={1} title="Marca da Loja & Logotipo" icon={<Store className="h-4 w-4" />} badge="Identidade">
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Nome exibido no cartão">
        <TextInput
          value={design.brand.storeName}
          onChange={(e) => patch({ brand: { ...design.brand, storeName: e.target.value } })}
          placeholder="Ex: Nox Dessert Club"
        />
      </Field>
      <Field label="Slogan / Categoria">
        <TextInput
          value={design.brand.tagline}
          onChange={(e) => patch({ brand: { ...design.brand, tagline: e.target.value } })}
          placeholder="Ex: Programa de Fidelidade Digital"
        />
      </Field>
    </div>
    <Field
      label="Logotipo da marca"
      hint="Ideal: 160×160px (até 512×512), proporção 1:1, PNG transparente ou SVG. Aparece no topo do passe na Apple e na Google Wallet."
    >
      <ImageUpload
        label="Carregar logo (PNG/SVG)"
        value={design.brand.logoDataUrl || design.brand.logoUrl}
        onChange={(dataUrl) => patch({ brand: { ...design.brand, logoDataUrl: dataUrl } })}
        onError={onError}
      />
    </Field>
  </Section>
);

// ── 2. Cores ────────────────────────────────────────────────────────────────
export const ColorsSection: React.FC<SectionProps> = ({ design, patch }) => (
  <Section step={2} title="Tema de Fundo & Cores" icon={<Palette className="h-4 w-4" />} badge="Visual">
    <Field label="Paletas pré-definidas">
      <div className="flex flex-wrap gap-2">
        {PALETTES.map((preset) => {
          const active = preset.colors.background === design.colors.background
            && preset.colors.accent === design.colors.accent;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => patch({ colors: { ...preset.colors } })}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                active ? 'border-primary bg-primary/10 text-foreground' : 'border-border/60 text-muted-foreground hover:text-foreground'
              }`}
            >
              <span className="h-4 w-4 rounded-full border border-white/20" style={{ backgroundColor: preset.swatch }} />
              {preset.name}
            </button>
          );
        })}
      </div>
    </Field>

    <div className="grid gap-3 sm:grid-cols-2">
      <ColorInput
        label="Cor de fundo do cartão"
        value={design.colors.background}
        onChange={(v) => patch({ colors: { ...design.colors, background: v } })}
      />
      <ColorInput
        label="Cor de destaque / selos"
        value={design.colors.accent}
        onChange={(v) => patch({ colors: { ...design.colors, accent: v } })}
      />
      <ColorInput
        label="Cor do texto principal"
        value={design.colors.text}
        onChange={(v) => patch({ colors: { ...design.colors, text: v } })}
      />
      <ColorInput
        label="Cor dos rótulos"
        value={design.colors.muted}
        onChange={(v) => patch({ colors: { ...design.colors, muted: v } })}
      />
      <ColorInput
        label="Conteúdo dentro do selo"
        value={design.colors.stampInk}
        onChange={(v) => patch({ colors: { ...design.colors, stampInk: v } })}
      />
    </div>
  </Section>
);

// ── 3. Selos ────────────────────────────────────────────────────────────────
export const StampsSection: React.FC<SectionProps> = ({ design, patch, onError }) => (
  <Section step={3} title="Selos da Cartela" icon={<Grid3x3 className="h-4 w-4" />} badge="Mecânica">
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Quantidade total de selos" hint="É a meta do programa: ao completar, o cliente resgata o mimo.">
        <Segmented
          value={design.stamps.total}
          onChange={(total) =>
            patch({
              stamps: { ...design.stamps, total, columns: total <= 6 ? total : 5 },
            })
          }
          options={STAMP_TOTAL_OPTIONS.map((n) => ({ value: n, label: String(n) }))}
        />
      </Field>

      <Field label="Formato do selo">
        <Segmented
          value={design.stamps.shape}
          onChange={(shape) => patch({ stamps: { ...design.stamps, shape } })}
          options={[
            { value: 'circle', label: 'Círculo' },
            { value: 'rounded', label: 'Arredondado' },
            { value: 'square', label: 'Quadrado' },
          ]}
        />
      </Field>
    </div>

    <Field label="O que aparece no selo conquistado">
      <Segmented
        value={design.stamps.fill}
        onChange={(fill) => patch({ stamps: { ...design.stamps, fill } })}
        options={[
          { value: 'number', label: 'Número' },
          { value: 'icon', label: 'Ícone' },
          { value: 'image', label: 'Imagem própria' },
        ]}
      />
    </Field>

    {design.stamps.fill === 'icon' && (
      <Field label="Escolha o ícone">
        <IconPicker
          value={design.stamps.iconKey}
          onChange={(iconKey) => patch({ stamps: { ...design.stamps, iconKey } })}
          accent={design.colors.accent}
        />
      </Field>
    )}

    {design.stamps.fill === 'image' && (
      <Field
        label="Imagem do selo"
        hint="Ideal: 96×96px, PNG transparente. Se não carregar, o ícone escolhido é usado como reserva."
      >
        <ImageUpload
          label="Carregar selo (PNG)"
          value={design.stamps.imageDataUrl}
          onChange={(imageDataUrl) => patch({ stamps: { ...design.stamps, imageDataUrl } })}
          onError={onError}
        />
      </Field>
    )}

    <Toggle
      checked={design.stamps.showNumbersOnEmpty}
      onChange={(v) => patch({ stamps: { ...design.stamps, showNumbersOnEmpty: v } })}
      label="Numerar os selos pendentes"
      description="Mostra 1, 2, 3… nos espaços ainda não conquistados"
    />

    <Field label="Colunas da cartela">
      <Segmented
        value={design.stamps.columns}
        onChange={(columns) => patch({ stamps: { ...design.stamps, columns } })}
        options={[3, 4, 5, 6].map((n) => ({ value: n, label: `${n} por linha` }))}
      />
    </Field>
  </Section>
);

// ── 4. Recompensa ───────────────────────────────────────────────────────────
export const RewardSection: React.FC<SectionProps> = ({ design, patch, onError }) => (
  <Section step={4} title="Recompensa (último selo)" icon={<Gift className="h-4 w-4" />} badge="Mimo">
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Título da recompensa">
        <TextInput
          value={design.reward.label}
          onChange={(e) => patch({ reward: { ...design.reward, label: e.target.value } })}
          placeholder="Ex: Cookie Grátis"
        />
      </Field>
      <Field label="Validade após completar (dias)">
        <TextInput
          type="number"
          min={1}
          value={design.reward.validityDays}
          onChange={(e) =>
            patch({ reward: { ...design.reward, validityDays: Math.max(1, Number(e.target.value) || 30) } })
          }
        />
      </Field>
    </div>

    <Field label="Instrução de resgate no balcão">
      <TextInput
        value={design.reward.description}
        onChange={(e) => patch({ reward: { ...design.reward, description: e.target.value } })}
        placeholder="Apresente o QR Code e retire seu mimo."
      />
    </Field>

    <div className="grid gap-4 sm:grid-cols-2">
      <ColorInput
        label="Cor do selo do prêmio"
        value={design.reward.color}
        onChange={(v) => patch({ reward: { ...design.reward, color: v } })}
      />
      <Field label="Imagem do prêmio (opcional)" hint="Ideal: 120×120px, PNG transparente.">
        <ImageUpload
          label="Carregar imagem"
          value={design.reward.imageDataUrl}
          onChange={(imageDataUrl) => patch({ reward: { ...design.reward, imageDataUrl } })}
          onError={onError}
        />
      </Field>
    </div>

    <Field label="Ícone do prêmio">
      <IconPicker
        value={design.reward.iconKey}
        onChange={(iconKey) => patch({ reward: { ...design.reward, iconKey } })}
        accent={design.reward.color}
      />
    </Field>
  </Section>
);

// ── 5. Informações ──────────────────────────────────────────────────────────
const FIELD_META: Array<{ key: keyof InfoFieldsConfig; label: string; description: string }> = [
  { key: 'cliente', label: 'Cliente', description: 'Nome de quem possui o cartão' },
  { key: 'faltam', label: 'Faltam', description: 'Quantos selos restam para o mimo' },
  { key: 'mimo', label: 'Mimo', description: 'Qual é a recompensa' },
  { key: 'unidade', label: 'Unidade', description: 'Loja/filial onde o cartão vale' },
  { key: 'programa', label: 'Programa', description: 'Nome do programa de fidelidade' },
  { key: 'status', label: 'Status', description: 'Ativo / Completo' },
  { key: 'validade', label: 'Validade', description: 'Prazo para resgatar' },
];

export const FieldsSection: React.FC<SectionProps> = ({ design, patch }) => (
  <Section step={5} title="Informações do Passe" icon={<ListChecks className="h-4 w-4" />} badge="Conteúdo">
    <p className="text-[11px] text-muted-foreground -mt-1">
      Escolha o que aparece no corpo do cartão. O rótulo é editável — o valor é preenchido
      automaticamente para cada cliente na emissão.
    </p>
    <div className="space-y-2.5">
      {FIELD_META.map(({ key, label, description }) => {
        const field = design.fields[key];
        return (
          <div key={key} className="space-y-2">
            <Toggle
              checked={field.enabled}
              onChange={(enabled) =>
                patch({ fields: { ...design.fields, [key]: { ...field, enabled } } })
              }
              label={label}
              description={description}
            />
            {field.enabled && (
              <div className="grid gap-2 pl-3 sm:grid-cols-2">
                <TextInput
                  value={field.label}
                  onChange={(e) =>
                    patch({ fields: { ...design.fields, [key]: { ...field, label: e.target.value } } })
                  }
                  placeholder="Rótulo"
                  className="!py-2 !text-xs"
                />
                {key === 'unidade' && (
                  <TextInput
                    value={field.value || ''}
                    onChange={(e) =>
                      patch({ fields: { ...design.fields, [key]: { ...field, value: e.target.value } } })
                    }
                    placeholder="Ex: Pinheiros"
                    className="!py-2 !text-xs"
                  />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  </Section>
);

// ── 6. QR Code ──────────────────────────────────────────────────────────────
export const QrSection: React.FC<SectionProps> = ({ design, patch }) => (
  <Section step={6} title="QR Code do Cartão" icon={<QrCode className="h-4 w-4" />} badge="Dinâmico">
    <Toggle
      checked={design.qr.enabled}
      onChange={(enabled) => patch({ qr: { ...design.qr, enabled } })}
      label="Exibir QR Code no passe"
      description="Gerado automaticamente e único por cliente"
    />

    {design.qr.enabled && (
      <>
        <Field
          label="Conteúdo do QR"
          hint="'Código do balcão' é o formato lido pelo scanner do lojista para creditar o selo."
        >
          <Segmented
            value={design.qr.format}
            onChange={(format) => patch({ qr: { ...design.qr, format } })}
            options={[
              { value: 'mimo', label: 'Código do balcão' },
              { value: 'url', label: 'Link da cartela' },
            ]}
          />
        </Field>

        <Field label="Legenda abaixo do QR">
          <TextInput
            value={design.qr.label}
            onChange={(e) => patch({ qr: { ...design.qr, label: e.target.value } })}
            placeholder="Apresente no caixa para creditar o selo"
          />
        </Field>

        <Toggle
          checked={design.qr.showPassCode}
          onChange={(showPassCode) => patch({ qr: { ...design.qr, showPassCode } })}
          label="Mostrar código do passe"
          description="Ex: MIMO-PASS-MA01, para busca manual no balcão"
        />
      </>
    )}
  </Section>
);
