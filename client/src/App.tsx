import React, { useState, useEffect } from 'react';
import { SiteHeader, SiteNavTab } from './components/SiteHeader.js';
import { SiteFooter } from './components/SiteFooter.js';
import { SiteHome } from './pages/site/SiteHome.js';
import { SiteComoFunciona } from './pages/site/SiteComoFunciona.js';
import { SitePrecos } from './pages/site/SitePrecos.js';
import { SiteContato } from './pages/site/SiteContato.js';
import { SiteLogin } from './pages/site/SiteLogin.js';
import { SitePainel } from './pages/site/SitePainel.js';

import { CustomerEnrollSlug } from './pages/CustomerEnrollSlug.js';

export const App: React.FC = () => {
  // Website active tab: inicio, como-funciona, precos, contato, login, painel, cliente-slug
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname);
  const [siteTab, setSiteTab] = useState<SiteNavTab>(() => {
    const path = window.location.pathname;
    if (path.includes('painel')) return 'painel';
    if (path.includes('login') || path.includes('entrar')) return 'login';
    if (path.includes('como-funciona')) return 'como-funciona';
    if (path.includes('precos') || path.includes('planos')) return 'precos';
    if (path.includes('contato')) return 'contato';
    return 'inicio';
  });

  useEffect(() => {
    if (currentPath.startsWith('/c/')) return;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const pathMap: Record<SiteNavTab, string> = {
      'inicio': '/',
      'como-funciona': '/como-funciona',
      'precos': '/precos',
      'contato': '/contato',
      'login': '/login',
      'painel': '/painel',
    };
    if (window.location.pathname !== pathMap[siteTab]) {
      window.history.pushState({}, '', pathMap[siteTab]);
      setCurrentPath(pathMap[siteTab]);
    }
  }, [siteTab]);

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      setCurrentPath(path);
      if (path.includes('painel')) setSiteTab('painel');
      else if (path.includes('login') || path.includes('entrar')) setSiteTab('login');
      else if (path.includes('como-funciona')) setSiteTab('como-funciona');
      else if (path.includes('precos') || path.includes('planos')) setSiteTab('precos');
      else if (path.includes('contato')) setSiteTab('contato');
      else setSiteTab('inicio');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

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

  // Se estiver no painel do lojista, renderiza o layout específico do painel sem o cabeçalho público
  if (siteTab === 'painel') {
    return <SitePainel onNavigate={(tab) => setSiteTab(tab)} />;
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

        {siteTab === 'login' && (
          <SiteLogin onNavigate={(tab) => setSiteTab(tab)} />
        )}
      </main>

      {/* Site Footer */}
      <SiteFooter onNavigate={(tab) => setSiteTab(tab)} />
    </div>
  );
};
export default App;
