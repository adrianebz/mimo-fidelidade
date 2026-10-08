import React from 'react';
import type { CardDesign, CardHolderData } from './types.js';
import { StampGrid } from './StampGrid.js';
import { StampGlyph } from './StampGlyph.js';
import { useQrCode } from './useQrCode.js';
import { montarCamposDoPasse } from './passFields.js';
import { usePreviaApple } from './usePreviaApple.js';

interface CardPreviewProps {
  design: CardDesign;
  holder: CardHolderData;
}

/**
 * Fonte do sistema: tudo o que o iOS desenha sozinho no passe (nome da loja,
 * rótulos, valores, código abaixo do QR) usa a fonte do sistema, não a
 * Montserrat. A Montserrat só aparece dentro das imagens que nós geramos.
 */
const FONTE_IOS = '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, "Segoe UI", Roboto, sans-serif';

/** Proporção da faixa do storeCard da Apple (375 × 144 pt). */
const PROPORCAO_FAIXA = 375 / 144;

/**
 * Prévia do passe na Apple Wallet.
 *
 * Reproduz as regras fixas do iOS, que o lojista não controla e que a prévia
 * antiga ignorava:
 *  - nome da loja e rótulos saem na mesma cor (o iOS não permite separar);
 *  - valores em peso regular, nunca negrito;
 *  - os campos ficam numa única linha de até 4; o excedente vai para o verso;
 *  - o código do cartão fica dentro da caixa branca do QR.
 *
 * A faixa (cartela) e o logo são as imagens geradas pelo servidor para o passe
 * real, via `usePreviaApple`. Se o servidor não responder, cai num desenho
 * aproximado e avisa.
 */
function calcularLuminanciaHex(hex: string): number {
  const clean = String(hex || '').replace('#', '').trim();
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return 0;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const a = [r, g, b].map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}

function corComContraste(texto: string, fundo: string): string {
  const lf = calcularLuminanciaHex(fundo);
  const lt = calcularLuminanciaHex(texto);
  const ratio = (Math.max(lf, lt) + 0.05) / (Math.min(lf, lt) + 0.05);
  if (ratio < 2.5) {
    return lf < 0.4 ? '#FFFFFF' : '#141416';
  }
  return texto;
}

export const CardPreviewApple: React.FC<CardPreviewProps> = ({ design, holder }) => {
  const { brand, colors, stamps, qr } = design;
  const { imagens, carregando, indisponivel } = usePreviaApple(design, holder.selos);

  // O passe Apple usa QR estático: o mesmo conteúdo que o servidor grava.
  const qrDataUrl = useQrCode(`BOOMII:${holder.cartaoId}`, qr.enabled);

  const campos = montarCamposDoPasse(design, holder);
  const frente = campos.slice(0, 4);
  const noVerso = campos.slice(4);
  const corTextoEfetiva = corComContraste(colors.text, colors.background);
  const corRotulo = corComContraste(colors.muted || colors.text, colors.background);

  return (
    <div
      className="w-full max-w-[272px] rounded-[14px] overflow-hidden shadow-2xl"
      style={{ backgroundColor: colors.background, color: corTextoEfetiva, fontFamily: FONTE_IOS }}
    >
      {/* Cabeçalho: logo (imagem nossa) + nome (texto do iOS) + SELOS */}
      <div className="flex items-center justify-between gap-2 px-3 pt-3 pb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          {imagens ? (
            <img src={imagens.logo} alt="" className="h-[27px] w-[27px] shrink-0" />
          ) : (
            <div
              className="h-[27px] w-[27px] rounded-full shrink-0 flex items-center justify-center overflow-hidden"
              style={{ backgroundColor: colors.accent }}
            >
              {brand.logoDataUrl || brand.logoUrl ? (
                <img src={brand.logoDataUrl || brand.logoUrl || ''} alt="" className="h-full w-full object-cover" />
              ) : (
                <StampGlyph icon={stamps.iconKey} color={colors.stampInk} size={14} />
              )}
            </div>
          )}
          <span className="text-[13px] font-semibold truncate" style={{ color: corRotulo }}>
            {brand.storeName}
          </span>
        </div>
        <div className="text-right shrink-0 leading-none">
          <div className="text-[8.5px] font-semibold tracking-[0.06em] uppercase" style={{ color: corRotulo }}>
            Selos
          </div>
          <div className="text-[19px] font-normal mt-0.5" style={{ color: colors.text }}>
            {holder.selos}/{stamps.total}
          </div>
        </div>
      </div>

      {/* Faixa: imagem gerada pelo servidor, de borda a borda como no iPhone */}
      <div className="relative w-full" style={{ aspectRatio: `${PROPORCAO_FAIXA}` }}>
        {imagens ? (
          <img
            src={imagens.faixa}
            alt="Cartela de selos"
            className={`absolute inset-0 h-full w-full transition-opacity ${carregando ? 'opacity-70' : 'opacity-100'}`}
          />
        ) : (
          <div className="absolute inset-0 p-[2.1%]">
            <div
              className="h-full w-full rounded-[10px] flex items-center justify-center px-2"
              style={{ backgroundColor: colors.accent }}
            >
              <StampGrid design={design} earned={holder.selos} cell={21} compact />
            </div>
          </div>
        )}
      </div>
      {indisponivel && !imagens && (
        <p className="px-3 pt-1 text-[8.5px] opacity-60">Prévia aproximada — faça login para ver a cartela exata.</p>
      )}

      {/* Campos: uma linha só, até 4. Primeiro à esquerda, último à direita,
          os do meio centralizados — mesma regra do pass.json. */}
      {frente.length > 0 && (
        <div className="flex items-start justify-between gap-2.5 px-3 pt-2.5">
          {frente.map((campo, i) => {
            const alinhamento =
              frente.length < 2 || i === 0 ? 'text-left' : i === frente.length - 1 ? 'text-right' : 'text-center';
            return (
              <div key={campo.chave} className={`min-w-0 ${alinhamento}`}>
                <div
                  className="text-[8.5px] font-semibold tracking-[0.06em] uppercase truncate"
                  style={{ color: corRotulo }}
                >
                  {campo.rotulo}
                </div>
                <div className="text-[12px] font-normal truncate" style={{ color: colors.text }}>
                  {campo.valor}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {noVerso.length > 0 && (
        <p className="px-3 pt-1 text-[8.5px] opacity-60">
          No verso do passe: {noVerso.map((c) => c.rotulo.toLowerCase()).join(', ')}
        </p>
      )}

      {/* QR: caixa branca do iOS, com o código dentro dela */}
      {qr.enabled ? (
        <div className="flex justify-center px-3 pt-4 pb-4">
          <div className="bg-white rounded-[6px] px-2 pt-2 pb-1.5 flex flex-col items-center">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="QR do cartão" className="w-[92px] h-[92px] block" />
            ) : (
              <div className="w-[92px] h-[92px] bg-zinc-100 rounded animate-pulse" />
            )}
            {qr.showPassCode && (
              <div className="mt-1 text-[9.5px] text-black" style={{ fontFamily: FONTE_IOS }}>
                {holder.passCode}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="pb-4" />
      )}
    </div>
  );
};

export default CardPreviewApple;
