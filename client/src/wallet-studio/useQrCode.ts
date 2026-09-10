import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/**
 * Gera o QR Code do cartão como data URI.
 *
 * O conteúdo é o mesmo formato lido pelo scanner do balcão
 * ("MIMO:{cartaoId}:{codigo}"), então o que o lojista vê na prévia é
 * exatamente o que o passe real vai carregar.
 */
export function useQrCode(value: string, enabled = true): string {
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    if (!enabled || !value) {
      setDataUrl('');
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(value, {
      width: 280,
      margin: 1,
      color: { dark: '#000000', light: '#FFFFFF' },
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setDataUrl('');
      });
    return () => {
      cancelled = true;
    };
  }, [value, enabled]);

  return dataUrl;
}
