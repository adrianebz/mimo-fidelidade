import React from 'react';
import type { CardDesign, CardHolderData } from './types.js';
import { StampGrid } from './StampGrid.js';
import { StampGlyph } from './StampGlyph.js';
import { useQrCode } from './useQrCode.js';

interface CardPreviewProps {
  design: CardDesign;
  holder: CardHolderData;
}

/**
 * Prévia no estilo Google Wallet.
 *
 * A Google Wallet monta o passe em blocos: cabeçalho da classe, saldo
 * (loyaltyPoints), imagem hero — que no MIMO é a cartela de selos gerada
 * dinamicamente pela Cloud Function generateBanner — e os módulos de texto
 * logo abaixo. A prévia reproduz essa mesma ordem para não iludir o lojista.
 */
export const CardPreviewGoogle: React.FC<CardPreviewProps> = ({ design, holder }) => {
  const { brand, colors, stamps, reward, fields, qr } = design;
  const faltam = Math.max(0, stamps.total - holder.selos);
  const qrValue = qr.format === 'url'
    ? `https://mimo-fidelidade.web.app/c/${holder.cartaoId}`
    : `MIMO:${holder.cartaoId}:${'8821'}`;
  const qrDataUrl = useQrCode(qrValue, qr.enabled);
  const logo = brand.logoDataUrl || brand.logoUrl;

  const textModules: Array<{ header: string; body: string }> = [];
  if (fields.cliente.enabled) textModules.push({ header: fields.cliente.label, body: holder.nome });
  if (fields.mimo.enabled) textModules.push({ header: 'PRÊMIO DO MIMO', body: reward.label });
  if (fields.faltam.enabled) {
    textModules.push({
      header: 'PROGRESSO DO CICLO',
      body:
        faltam === 0
          ? `Cartão completo! (${holder.selos}/${stamps.total} selos)`
          : `${holder.selos} de ${stamps.total} selos acumulados (Faltam ${faltam})`,
    });
  }
  if (fields.unidade.enabled) {
    textModules.push({ header: fields.unidade.label, body: holder.unidade || fields.unidade.value || 'Matriz' });
  }
  if (fields.status.enabled) {
    textModules.push({ header: fields.status.label, body: holder.status || (faltam === 0 ? 'Completo' : 'Ativo') });
  }
  if (fields.validade.enabled) {
    textModules.push({ header: fields.validade.label, body: `${reward.validityDays} dias após completar` });
  }
  textModules.push({ header: 'INSTRUÇÕES NO BALCÃO', body: reward.description });

  return (
    <div className="w-full max-w-[272px] rounded-[26px] overflow-hidden bg-[#202124] shadow-2xl">
      {/* Cabeçalho da classe */}
      <div className="px-4 pt-4 pb-3" style={{ backgroundColor: colors.background }}>
        <div className="flex items-center gap-2">
          <div
            className="h-7 w-7 rounded-full shrink-0 flex items-center justify-center overflow-hidden"
            style={{ backgroundColor: colors.accent }}
          >
            {logo ? (
              <img src={logo} alt={brand.storeName} className="h-full w-full object-cover" />
            ) : (
              <StampGlyph icon={stamps.iconKey} color={colors.stampInk} size={15} />
            )}
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold truncate" style={{ color: colors.text }}>
              {brand.tagline}
            </div>
            <div className="text-[13px] font-bold truncate leading-tight" style={{ color: colors.text }}>
              {brand.storeName}
            </div>
          </div>
        </div>

        {/* Saldo (loyaltyPoints) */}
        <div className="mt-3.5">
          <div className="text-[8.5px] font-semibold tracking-[0.14em]" style={{ color: colors.muted }}>
            CARTÃO MIMO
          </div>
          <div className="text-[20px] font-black leading-tight" style={{ color: colors.accent }}>
            {holder.selos} / {stamps.total} SELOS
          </div>
        </div>
      </div>

      {/* Hero image = cartela gerada dinamicamente */}
      <div className="px-2.5 pb-2.5" style={{ backgroundColor: colors.background }}>
        <div
          className="rounded-[14px] px-3 py-3.5"
          style={{ backgroundColor: colors.accent }}
        >
          <StampGrid design={design} earned={holder.selos} cell={34} compact />
        </div>
      </div>

      {/* Módulos de texto */}
      <div className="bg-[#202124] px-3 py-3 space-y-2">
        {textModules.map((mod, i) => (
          <div key={`${mod.header}-${i}`} className="bg-[#2A2B2E] rounded-[10px] px-3 py-2">
            <div className="text-[8.5px] font-semibold tracking-[0.1em] text-zinc-400">{mod.header}</div>
            <div className="text-[11px] font-semibold text-white mt-0.5 leading-snug">{mod.body}</div>
          </div>
        ))}

        {/* QR Code */}
        {qr.enabled && (
          <div className="bg-white rounded-[12px] p-3 flex flex-col items-center mt-1">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="QR do cartão" className="w-[108px] h-[108px] block" />
            ) : (
              <div className="w-[108px] h-[108px] bg-zinc-100 rounded animate-pulse" />
            )}
            {qr.showPassCode && (
              <div className="mt-1.5 text-[9px] font-mono tracking-[0.1em] text-zinc-500">{holder.passCode}</div>
            )}
            <div className="text-[8.5px] text-zinc-400 text-center mt-1 leading-snug">{qr.label}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CardPreviewGoogle;
