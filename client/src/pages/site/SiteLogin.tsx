import React, { useState } from 'react';
import { ShieldCheck, ArrowRight, Lock, Mail, CheckCircle2 } from 'lucide-react';
import { SiteNavTab } from '../../components/SiteHeader.js';

interface SiteLoginProps {
  onNavigate: (tab: SiteNavTab) => void;
}

export const SiteLogin: React.FC<SiteLoginProps> = ({ onNavigate }) => {
  const [email, setEmail] = useState("lojista@minhaloja.com.br");
  const [senha, setSenha] = useState("••••••••");
  const [loading, setLoading] = useState(false);
  const [lembrar, setLembrar] = useState(true);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      onNavigate('painel');
    }, 500);
  };

  const handleDemoLogin = () => {
    setEmail("lojista@minhaloja.com.br");
    setSenha("senha-segura");
    setLoading(true);
    setTimeout(() => {
      onNavigate('painel');
    }, 300);
  };

  return (
    <div className="relative min-h-[calc(100vh-140px)] flex items-center justify-center px-4 py-12">
      {/* Ambient background glow */}
      <div
        className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 h-[450px] w-[500px] rounded-full opacity-15 blur-3xl"
        style={{ background: "var(--gradient-yellow)" }}
      />

      <div className="w-full max-w-md space-y-6 relative z-10">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-xs font-semibold text-primary">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Portal do Lojista Mimo</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Bem-vindo de volta.
          </h1>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            Acompanhe seus clientes, libere mimos e gerencie o programa de fidelidade da sua loja.
          </p>
        </div>

        {/* Demo Fast-Login Card */}
        <div className="surface-panel p-4 border border-primary/40 bg-card shadow-lg">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-semibold text-emerald-400">
                  Plano em dia • Acesso Imediato
                </span>
              </div>
              <p className="text-xs text-foreground font-medium">
                Ambiente: <strong className="text-primary">Painel do Lojista</strong> (Balcão Ativo)
              </p>
            </div>
            <button
              type="button"
              onClick={handleDemoLogin}
              disabled={loading}
              className="btn-mimo py-1.5 px-3.5 text-xs whitespace-nowrap cursor-pointer shrink-0"
            >
              {loading ? "Entrando..." : "Acesso Rápido ⚡"}
            </button>
          </div>
        </div>

        {/* Main Login Form */}
        <form onSubmit={handleLogin} className="surface-panel p-8 space-y-5">
          <div className="space-y-1 pb-1 border-b border-border/60">
            <h2 className="text-lg font-semibold text-foreground">Entrar com credenciais</h2>
            <p className="text-xs text-muted-foreground">
              Acesso exclusivo para lojistas cadastrados e adimplentes.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="label-eyebrow block mb-1.5">
                E-mail da Loja ou Operador
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contato@sualoja.com.br"
                  className="w-full rounded-xl border border-input bg-background pl-10 pr-4 py-2.5 text-sm text-foreground outline-none focus:border-primary transition-colors"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="senha" className="label-eyebrow">
                  Senha
                </label>
                <button
                  type="button"
                  onClick={() => alert("Para redefinir sua senha, contate contato@mimo.com.br")}
                  className="text-xs text-primary hover:underline cursor-pointer bg-transparent border-0 p-0"
                >
                  Esqueceu a senha?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  id="senha"
                  type="password"
                  required
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="Sua senha secreta"
                  className="w-full rounded-xl border border-input bg-background pl-10 pr-4 py-2.5 text-sm text-foreground outline-none focus:border-primary transition-colors"
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={lembrar}
                  onChange={(e) => setLembrar(e.target.checked)}
                  className="rounded border-input text-primary focus:ring-primary h-4 w-4 bg-background"
                />
                <span>Lembrar meu acesso neste dispositivo</span>
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-mimo w-full py-3 text-sm font-bold flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <span>Autenticando...</span>
            ) : (
              <>
                <span>Acessar Painel da Loja</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          <div className="pt-2 text-center text-xs text-muted-foreground">
            <span>Ainda não tem o Mimo na sua loja? </span>
            <button
              type="button"
              onClick={() => onNavigate('precos')}
              className="text-primary hover:underline font-semibold cursor-pointer bg-transparent border-0 p-0"
            >
              Conheça nossos planos
            </button>
          </div>
        </form>

        {/* Security & Status Guarantee Note */}
        <div className="p-4 rounded-xl border border-border/40 bg-card text-xs text-muted-foreground space-y-1 text-center">
          <p className="flex items-center justify-center gap-1.5 text-foreground font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Controle de Adimplência Integrado</span>
          </p>
          <p>
            Lojistas com plano ativo possuem sincronização em tempo real com a Apple Wallet e a Google Wallet.
          </p>
        </div>
      </div>
    </div>
  );
};
