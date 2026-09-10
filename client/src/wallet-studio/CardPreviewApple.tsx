import React from 'react';
import type { CardDesign, CardHolderData } from './types.js';
import { StampGrid } from './StampGrid.js';
import { StampGlyph } from './StampGlyph.js';
import { useQrCode } from './useQrCode.js';

interface CardPreviewProps {
  design: CardDesign;
  holder: CardHolderData;
}

interface Row {
  label: string;
  value: string;
}

function buildRows(design: CardDesign, holder: CardHolderData): Row[] {
  const { fields, reward, stamps } = design;
  const faltam = Math.max(0, stamps.total - holder.selos);
  const rows: Row[] = [];

  if (fields.cliente.enabled) rows.push({ label: fields.cliente.label, value: holder.nome });
  if (fields.faltam.enabled) {
    rows.push({
      label: fields.faltam.label,
      value: faltam === 0 ? 'Mimo liberado!' : `${faltam} ${faltam === 1 ? 'selo' : 'selos'}`,
    });
  }
  if (fields.mimo.enabled) rows.push({ label: fields.mimo.label, value: reward.label });
  if (fields.unidade.enabled) {
    rows.push({ label: fields.unidade.label, value: holder.unidade || fields.unidade.value || 'Matriz' });
  }
  if (fields.programa.enabled) rows.push({ label: fields.programa.label, value: design.brand.tagline });
  if (fields.status.enabled) {
    rows.push({ label: fields.status.label, value: holder.status || (faltam === 0 ? 'Completo' : 'Ativo') });
  }
  if (fields.validade.enabled) {
    rows.push({ label: fields.validade.label, value: `${reward.validityDays} dias após completar` });
  }
  return rows;
}

/**
 * Prévia no estilo Apple Wallet: cartão único, painel de selos em destaque
 * e campos em duas colunas, com o QR Code ao pé do passe.
 */
export const CardPreviewApple: React.FC<CardPreviewProps> = ({ design, holder }) => {
  const { brand, colors, stamps, reward, qr } = design;
  const qrValue = qr.format === 'url'
    ? `https://mimo-fidelidade.web.app/c/${holder.cartaoId}`
    : `MIMO:${holder.cartaoId}:${'8821'}`;
  const qrDataUrl = useQrCode(qrValue, qr.enabled);
  const rows = buildRows(design, holder);
  const logo = brand.logoDataUrl || brand.logoUrl;

  return (
    <div
      className="w-full max-w-[272px] rounded-[26px] overflow-hidden shadow-2xl"
      style={{ backgroundColor: colors.background, color: colors.text }}
    >
      {/* Cabeçalho: marca + saldo */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="h-8 w-8 rounded-full shrink-0 flex items-center justify-center overflow-hidden"
            style={{ backgroundColor: colors.accent }}
          >
            {logo ? (
              <img src={logo} alt={brand.storeName} className="h-full w-full object-cover" />
            ) : (
              <StampGlyph icon={stamps.iconKey} color={colors.stampInk} size={17} />
            )}
          </div>
          <span className="text-[13px] font-bold truncate">{brand.storeName}</span>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[8px] font-semibold tracking-[0.14em]" style={{ color: colors.muted }}>
            SELOS
          </div>
          <div className="text-[15px] font-black leading-none" style={{ color: colors.accent }}>
            {holder.selos}/{stamps.total}
          </div>
        </div>
      </div>

      {/* Painel da cartela */}
      <div className="px-3.5">
        <div className="rounded-[18px] px-3.5 py-4" style={{ backgroundColor: colors.accent }}>
          <div
            className="text-[9px] font-bold tracking-[0.16em] mb-3 leading-snug"
            style={{ color: colors.stampInk }}
          >
            CARTÃO DE FIDELIDADE
            <br />
            {brand.tagline.toUpperCase()}
          </div>
          <StampGrid design={design} earned={holder.selos} cell={38} compact />
        </div>
      </div>

      {/* Campos do passe */}
      {rows.length > 0 && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-3.5 px-4 pt-4">
          {rows.map((row, i) => (
            <div key={`${row.label}-${i}`} className={i % 2 === 1 ? 'text-right' : ''}>
              <div className="text-[8px] font-semibold tracking-[0.14em]" style={{ color: colors.muted }}>
                {row.label}
              </div>
              <div className="text-[11.5px] font-bold truncate" style={{ color: colors.text }}>
                {row.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* QR Code */}
      {qr.enabled && (
        <div className="flex flex-col items-center px-4 pt-5 pb-4">
          <div className="bg-white rounded-[14px] p-2.5">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="QR do cartão" className="w-[104px] h-[104px] block" />
            ) : (
              <div className="w-[104px] h-[104px] bg-zinc-100 rounded animate-pulse" />
            )}
          </div>
          {qr.showPassCode && (
            <div className="mt-2 text-[9px] font-mono tracking-[0.12em]" style={{ color: colors.muted }}>
              {holder.passCode}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CardPreviewApple;
