/**
 * Endereços públicos do Boomii.
 *
 * O site institucional e a área do lojista são o mesmo SPA, no mesmo deploy do
 * Firebase Hosting. O endereço oficial é `www.boomii.com.br`, e a área do
 * lojista vive em `/areadolojista` dentro dele.
 */

/** Caminho oficial da área do lojista. */
export const CAMINHO_AREA_LOJISTA = '/arealojista';

/** Caminho anterior. Continua reconhecido para links já distribuídos. */
export const CAMINHO_AREA_LOJISTA_LEGADO = '/areadolojista';

/**
 * Destino do botão "Área do Lojista".
 *
 * É relativo de propósito: resolve no host que estiver servindo a página, então
 * funciona tanto no `.web.app` quanto em `www.boomii.com.br` sem alteração de
 * código — e continua correto durante a janela em que o domínio próprio ainda
 * não terminou de propagar.
 *
 * `VITE_HOST_AREA_LOJISTA` força um host absoluto, caso um dia a área do
 * lojista passe a morar em outro domínio.
 */
export const URL_AREA_LOJISTA = import.meta.env.VITE_HOST_AREA_LOJISTA
  ? `https://${import.meta.env.VITE_HOST_AREA_LOJISTA}${CAMINHO_AREA_LOJISTA}`
  : CAMINHO_AREA_LOJISTA;
