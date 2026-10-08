import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Configuração Hardened do Capacitor para o Boomii Lojista (iOS/Android).
 *
 * Diretrizes de Segurança aplicadas:
 * 1. `iosScheme: 'https'` garante contexto seguro (Secure Context) para WebCrypto e Câmera.
 * 2. `allowNavigation`: Whitelist restrita de domínios para evitar sequestro de WKWebView ou phishing.
 * 3. `appendUserAgent`: Identificador seguro para o frontend reconhecer o terminal nativo.
 */
const config: CapacitorConfig = {
  appId: 'com.boomii.lojista',
  appName: 'Boomii Lojista',
  webDir: 'client/dist',
  server: {
    iosScheme: 'https',
    androidScheme: 'https',
    allowNavigation: [
      'boomii-fidelidade.web.app',
      'boomii.com.br',
      'www.boomii.com.br',
      'mimo-fidelidade.web.app',
      '*.firebaseio.com',
      '*.googleapis.com',
      'identitytoolkit.googleapis.com',
      'securetoken.googleapis.com',
    ],
  },
  ios: {
    appendUserAgent: 'BoomiiScannerApp/1.0.0 (iOS Native Terminal)',
    scrollEnabled: true,
    preferredContentMode: 'mobile',
  },
};

export default config;
