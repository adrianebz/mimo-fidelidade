import React, { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase.js';
import { encerrarSessao } from './services/boomiiWalletService.js';
import { SiteHeader, SiteNavTab } from './components/SiteHeader.js';
import { SiteFooter } from './components/SiteFooter.js';
import { SiteHome } from './pages/site/SiteHome.js';
import { SiteComoFunciona } from './pages/site/SiteComoFunciona.js';
import { SitePrecos } from './pages/site/SitePrecos.js';
import { SiteContato } from './pages/site/SiteContato.js';
import { SiteLogin } from './pages/site/SiteLogin.js';
import { SitePainel } from './pages/site/SitePainel.js';
import { AdminContas } from './pages/site/AdminContas.js';
import { CustomerEnrollSlug } from './pages/CustomerEnrollSlug.js';
import { CAMINHO_AREA_LOJISTA, CAMINHO_AREA_LOJISTA_LEGADO } from './siteConfig.js';

/**
 * `/areadolojista` é a rota oficial. `/arealojista`, `/login` e `/entrar`
 * continuam aceitos: são caminhos anteriores, possivelmente já em favoritos.
 *
 * A ordem importa — `arealojista` não é substring de `areadolojista`, então
 * os dois precisam ser testados separadamente.
 */
function ehRotaDoLojista(path: string): boolean {
  const semBarra = (p: string) => p.replace('/', '');
  return (
    path.includes(semBarra(CAMINHO_AREA_LOJISTA)) ||
    path.includes(semBarra(CAMINHO_AREA_LOJISTA_LEGADO)) ||
    path.includes('login') ||
    path.includes('entrar')
  );
}

/**
 * Sessão do Firebase Auth. O papel vem das custom claims do token — a mesma
 * informação que o firestore.rules usa —, e não de flags no localStorage, que
 * qualquer pessoa edita no navegador.
 */
type Sessao =
  | { carregando: true }
  | { carregando: false; papel: 'admin' | 'lojista' | null };

function TelaCarregando() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-9 w-9 rounded-full border-4 border-primary border-t-transparent animate-spin" aria-label="Carregando" />
    </div>
  );
}

export const App: React.FC = () => {
  const [sessao, setSessao] = useState<Sessao>({ carregando: true });

  useEffect(
    () =>
      onAuthStateChanged(auth, async (user) => {
        if (!user) {
          setSessao({ carregando: false, papel: null });
          return;
        }
        // Volta a "carregando" enquanto lê as claims: logo após o login, o
        // papel ainda não é conhecido e a guarda abaixo não pode expulsar o
        // usuário de volta para o login nesse intervalo.
        setSessao({ carregando: true });
        try {
          const { claims } = await user.getIdTokenResult();
          const papel = claims.role === 'admin' || claims.role === 'lojista' ? claims.role : null;
          // Lojista vê sempre a própria loja, a que está no token.
          if (papel === 'lojista' && claims.lojaId) {
            localStorage.setItem('boomii_active_lojista', String(claims.lojaId));
          }
          setSessao({ carregando: false, papel });
        } catch {
          setSessao({ carregando: false, papel: null });
        }
      }),
    []
  );

  // Modo aplicativo nativo (APK / iOS): abre direto no Painel do Lojista e desativa páginas de marketing
  const isAppMode = typeof window !== 'undefined' && (
    new URLSearchParams(window.location.search).get('mode') === 'app' ||
    navigator.userAgent.includes('BoomiiScannerApp') ||
    navigator.userAgent.includes('MimoScannerApp') ||
    (window as any).isNativeApp === true ||
    Boolean((window as any).Capacitor?.isNativePlatform?.())
  );

  const [selectedStoreSlug, setSelectedStoreSlug] = useState<string>(() => {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('boomii_active_lojista') || 'nox-dessert-club';
    }
    return 'nox-dessert-club';
  });

  // Website active tab: inicio, como-funciona, precos, contato, login, painel, admin, cliente-slug
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname);
  const [siteTab, setSiteTab] = useState<SiteNavTab>(() => {
    const path = window.location.pathname;
    if (typeof localStorage !== 'undefined' && localStorage.getItem('boomii_admin_session') === 'true' && (path.includes('admin') || ehRotaDoLojista(path))) {
      return 'admin';
    }
    if (isAppMode) return 'painel';
    if (path.includes('admin')) return 'admin';
    if (path.includes('painel')) return 'painel';
    if (ehRotaDoLojista(path)) return 'login';
    if (path.includes('como-funciona')) return 'como-funciona';
    if (path.includes('precos') || path.includes('planos')) return 'precos';
    if (path.includes('contato')) return 'contato';
    return 'inicio';
  });

  useEffect(() => {
    if (currentPath.startsWith('/c/')) return;
    if (isAppMode && siteTab !== 'painel' && siteTab !== 'login' && siteTab !== 'admin') {
      setSiteTab('painel');
      return;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const pathMap: Record<SiteNavTab, string> = {
      'inicio': isAppMode ? '/painel' : '/',
      'como-funciona': isAppMode ? '/painel' : '/como-funciona',
      'precos': isAppMode ? '/painel' : '/precos',
      'contato': isAppMode ? '/painel' : '/contato',
      'login': CAMINHO_AREA_LOJISTA,
      'painel': '/painel',
      'admin': '/admin',
    };
    if (window.location.pathname !== pathMap[siteTab]) {
      window.history.pushState({}, '', pathMap[siteTab]);
      setCurrentPath(pathMap[siteTab]);
    }
  }, [siteTab, isAppMode]);

  useEffect(() => {
    const handlePopState = () => {
      if (isAppMode) {
        setSiteTab('painel');
        return;
      }
      const path = window.location.pathname;
      setCurrentPath(path);
      if (path.includes('admin')) setSiteTab('admin');
      else if (path.includes('painel')) setSiteTab('painel');
      else if (ehRotaDoLojista(path)) setSiteTab('login');
      else if (path.includes('como-funciona')) setSiteTab('como-funciona');
      else if (path.includes('precos') || path.includes('planos')) setSiteTab('precos');
      else if (path.includes('contato')) setSiteTab('contato');
      else setSiteTab('inicio');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isAppMode]);

  // Guarda das áreas restritas: painel exige lojista ou admin; contas, só admin.
  // Antes o painel abria para qualquer visitante — vazio, porque o Firestore
  // negava os dados, mas como se a loja não tivesse clientes.
  const acessoNegado =
    !sessao.carregando &&
    ((siteTab === 'painel' && !sessao.papel) || (siteTab === 'admin' && sessao.papel !== 'admin'));

  useEffect(() => {
    if (!acessoNegado || sessao.carregando) return;
    setSiteTab(siteTab === 'admin' && sessao.papel === 'lojista' ? 'painel' : 'login');
  }, [acessoNegado, sessao, siteTab]);

  /** Encerra a sessão de verdade: sem isso, "Sair" só trocava de tela. */
  const sair = async () => {
    await encerrarSessao();
    localStorage.removeItem('boomii_admin_session');
    localStorage.removeItem('boomii_active_lojista');
    setSiteTab('login');
  };

  // Se a rota atual for o cadastro público do cliente (/c/{slug})
  if (currentPath.startsWith('/c/')) {
    return (
      <CustomerEnrollSlug
        onBackToSite={() => {
          window.history.pushState({}, '', '/');
          setCurrentPath('/');
          setSiteTab('inicio');
        }}
      />
    );
  }

  if ((siteTab === 'painel' || siteTab === 'admin') && (sessao.carregando || acessoNegado)) {
    return <TelaCarregando />;
  }

  // Se for o painel master de administração de contas
  if (siteTab === 'admin') {
    return (
      <AdminContas
        onNavigate={(tab) => setSiteTab(tab)}
        onSelectStore={(slug) => {
          setSelectedStoreSlug(slug);
          localStorage.setItem('boomii_active_lojista', slug);
        }}
        onLogout={sair}
      />
    );
  }

  // Se estiver no painel do lojista, renderiza o layout específico do painel sem o cabeçalho público.
  // No app, qualquer aba que não seja login cai aqui: ele NUNCA renderiza o site institucional.
  if (siteTab === 'painel' || (isAppMode && siteTab !== 'login')) {
    return <SitePainel onNavigate={(tab) => setSiteTab(tab)} onSair={sair} />;
  }

  // A área do lojista é uma tela isolada: sem cabeçalho nem rodapé do site.
  // Quem chega aqui veio para entrar no sistema, não para navegar pelo site —
  // e a navegação institucional só daria saída acidental no meio do login.
  // É a mesma tela no navegador e no app; antes o app a mostrava sem este
  // contêiner (sem fundo nem fonte do tema).
  if (siteTab === 'login') {
    return (
      <div className="flex min-h-screen flex-col bg-background text-foreground font-sans antialiased selection:bg-primary selection:text-primary-foreground pt-[env(safe-area-inset-top)]">
        <SiteLogin
          onNavigate={(tab) => setSiteTab(tab)}
          onSelectStore={(slug) => {
            setSelectedStoreSlug(slug);
            localStorage.setItem('boomii_active_lojista', slug);
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground font-sans antialiased selection:bg-primary selection:text-primary-foreground">
      {/* Site Header */}
      <SiteHeader
        currentTab={siteTab}
        onNavigate={(tab) => setSiteTab(tab)}
      />

      {/* Site Pages */}
      <main className="flex-1">
        {siteTab === 'inicio' && (
          <SiteHome onNavigate={(tab) => setSiteTab(tab)} />
        )}

        {siteTab === 'como-funciona' && (
          <SiteComoFunciona onNavigate={(tab) => setSiteTab(tab)} />
        )}

        {siteTab === 'precos' && (
          <SitePrecos onNavigate={(tab) => setSiteTab(tab)} />
        )}

        {siteTab === 'contato' && (
          <SiteContato />
        )}
      </main>

      {/* Site Footer */}
      <SiteFooter onNavigate={(tab) => setSiteTab(tab)} />
    </div>
  );
};
export default App;
