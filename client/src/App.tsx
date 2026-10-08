import React, { useState, useEffect } from 'react';
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

export const App: React.FC = () => {
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

  // Se for o painel master de administração de contas
  if (siteTab === 'admin') {
    return (
      <AdminContas
        onNavigate={(tab) => setSiteTab(tab)}
        onSelectStore={(slug) => {
          setSelectedStoreSlug(slug);
          localStorage.setItem('boomii_active_lojista', slug);
        }}
        onLogout={() => {
          localStorage.removeItem('boomii_admin_session');
          setSiteTab('login');
        }}
      />
    );
  }

  // Se estiver em modo app (APK), garante que NUNCA renderiza a página institucional
  if (isAppMode) {
    if (siteTab === 'login') {
      return (
        <SiteLogin
          onNavigate={(tab) => setSiteTab(tab)}
          onSelectStore={(slug) => {
            setSelectedStoreSlug(slug);
            localStorage.setItem('boomii_active_lojista', slug);
          }}
        />
      );
    }
    return <SitePainel onNavigate={(tab) => setSiteTab(tab)} />;
  }

  // Se estiver no painel do lojista, renderiza o layout específico do painel sem o cabeçalho público
  if (siteTab === 'painel') {
    return <SitePainel onNavigate={(tab) => setSiteTab(tab)} />;
  }

  // A área do lojista é uma tela isolada: sem cabeçalho nem rodapé do site.
  // Quem chega aqui veio para entrar no sistema, não para navegar pelo site —
  // e a navegação institucional só daria saída acidental no meio do login.
  if (siteTab === 'login') {
    return (
      <div className="flex min-h-screen flex-col bg-background text-foreground font-sans antialiased selection:bg-primary selection:text-primary-foreground">
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
