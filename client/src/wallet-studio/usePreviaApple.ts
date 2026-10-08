import { useEffect, useMemo, useRef, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase.js';
import type { CardDesign } from './types.js';

export interface ImagensPreviaApple {
  /** Faixa com a cartela (strip.png do passe), em data URL. */
  faixa: string;
  /** Logo do cabeçalho (logo.png do passe), em data URL. */
  logo: string;
}

/**
 * Busca a faixa e o logo do passe Apple renderizados pela Cloud Function
 * `previaPasseApple` — o mesmo código que monta o .pkpass real.
 *
 * Antes a prévia desenhava a cartela no navegador, com outra geometria, e o
 * cartão no iPhone saía diferente do que o lojista tinha configurado. Agora as
 * partes que nós desenhamos vêm literalmente do servidor; só o que o iOS
 * desenha sozinho (textos dos campos, cabeçalho, QR) é imitado em HTML.
 *
 * Espera o lojista parar de editar (debounce) antes de pedir, e descarta
 * respostas atrasadas de pedidos anteriores.
 */
export function usePreviaApple(design: CardDesign, selos: number, atrasoMs = 450) {
  const [imagens, setImagens] = useState<ImagensPreviaApple | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [indisponivel, setIndisponivel] = useState(false);
  const ultimo = useRef(0);

  // `version` e `updatedAt` mudam ao publicar, mas não afetam o desenho.
  const chave = useMemo(() => {
    const { version: _v, updatedAt: _u, ...visual } = design;
    return JSON.stringify(visual);
  }, [design]);

  useEffect(() => {
    const id = ++ultimo.current;
    setCarregando(true);
    const timer = setTimeout(async () => {
      try {
        const gerar = httpsCallable<{ design: CardDesign; selos: number }, ImagensPreviaApple>(
          functions,
          'previaPasseApple'
        );
        const { data } = await gerar({ design, selos });
        if (id === ultimo.current) {
          setImagens(data);
          setIndisponivel(false);
        }
      } catch {
        // Sem login, sem rede ou função ainda não publicada: a prévia cai na
        // versão desenhada no navegador e avisa que é aproximada.
        if (id === ultimo.current) setIndisponivel(true);
      } finally {
        if (id === ultimo.current) setCarregando(false);
      }
    }, atrasoMs);
    return () => clearTimeout(timer);
    // `chave` resume o design; usar o objeto faria pedir de novo a cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, selos, atrasoMs]);

  return { imagens, carregando, indisponivel };
}
