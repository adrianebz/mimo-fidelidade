/**
 * Tema claro/escuro.
 *
 * A troca é feita pela classe `dark` no <html>, que é a mesma âncora usada pelo
 * `@custom-variant dark` do theme.css — então os tokens de cor e as utilidades
 * `dark:` mudam juntos, sem nenhum componente precisar saber qual tema está
 * ativo.
 *
 * O padrão é escuro para preservar a aparência que a base já conhece; quem
 * trocar uma vez tem a escolha lembrada neste dispositivo.
 */
import { useCallback, useEffect, useState } from 'react';

export type Tema = 'claro' | 'escuro';

const CHAVE = 'boomii_tema';

export function lerTemaSalvo(): Tema {
  if (typeof localStorage === 'undefined') return 'escuro';
  try {
    const salvo = localStorage.getItem(CHAVE);
    if (salvo === 'claro' || salvo === 'escuro') return salvo;
  } catch {
    // Navegação privada ou storage bloqueado: cai no padrão.
  }
  return 'escuro';
}

export function aplicarTema(tema: Tema): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', tema === 'escuro');
  try {
    localStorage.setItem(CHAVE, tema);
  } catch {
    // Sem persistência, o tema ainda vale para esta sessão.
  }
}

/** Estado do tema já sincronizado com o <html> e com o localStorage. */
export function useTema(): { tema: Tema; alternarTema: () => void } {
  const [tema, setTema] = useState<Tema>(lerTemaSalvo);

  useEffect(() => {
    aplicarTema(tema);
  }, [tema]);

  const alternarTema = useCallback(() => {
    setTema((atual) => (atual === 'escuro' ? 'claro' : 'escuro'));
  }, []);

  return { tema, alternarTema };
}
