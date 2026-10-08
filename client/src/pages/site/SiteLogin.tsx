import React, { useState } from 'react';
import { ShieldCheck, ArrowRight, Lock, Mail, AlertCircle, RefreshCw, MailCheck, Eye, EyeOff } from 'lucide-react';
import { SiteNavTab } from '../../components/SiteHeader.js';
import {
  autenticarLojista,
  autenticarAdminBoomii,
  enviarRedefinicaoDeSenha,
  MASTER_ADMIN_EMAIL,
} from '../../services/boomiiWalletService.js';

interface SiteLoginProps {
  onNavigate: (tab: SiteNavTab) => void;
  onSelectStore?: (slug: string) => void;
}

export const SiteLogin: React.FC<SiteLoginProps> = ({ onNavigate, onSelectStore }) => {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [avisoMsg, setAvisoMsg] = useState<string | null>(null);
  const [enviandoReset, setEnviandoReset] = useState(false);
  const [lembrar, setLembrar] = useState(true);
  const [mostrarSenha, setMostrarSenha] = useState(false);

  /**
   * Redefinição de senha pelo próprio Firebase Auth.
   *
   * Quando o e-mail não tem conta, a mensagem diz isso claramente, em vez de
   * fingir que enviou — decisão de produto, ver `enviarRedefinicaoDeSenha`.
   */
  const handleRedefinirSenha = async () => {
    const emailLimpo = email.toLowerCase().trim();
    setErrorMsg(null);
    setAvisoMsg(null);

    if (!emailLimpo) {
      setErrorMsg('Informe o e-mail de acesso antes de pedir a redefinição.');
      return;
    }

    setEnviandoReset(true);
    try {
      const res = await enviarRedefinicaoDeSenha(emailLimpo);
      if (res.sucesso) {
        setAvisoMsg(
          `Link de redefinição enviado para ${emailLimpo}. Confira também a caixa de spam.`
        );
      } else {
        setErrorMsg(res.erro || 'Não foi possível enviar o e-mail de redefinição.');
      }
    } finally {
      setEnviandoReset(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setAvisoMsg(null);

    const emailLimpo = email.toLowerCase().trim();
    const senhaLimpa = senha.trim();

    if (!emailLimpo || !senhaLimpa) {
      setErrorMsg('Informe o e-mail e a senha cadastrados.');
      return;
    }

    setLoading(true);

    try {
      // 1. Verificação de Administrador Master (Adriane Bezerra) — a senha é
      // comparada no servidor, nunca no navegador.
      if (emailLimpo === MASTER_ADMIN_EMAIL.toLowerCase()) {
        const adminRes = await autenticarAdminBoomii(emailLimpo, senhaLimpa);
        if (adminRes.sucesso) {
          localStorage.setItem('boomii_admin_session', 'true');
          setTimeout(() => {
            onNavigate('admin' as any);
          }, 300);
          return;
        }
      }

      // 2. Verificação de Lojista Cliente no Firestore
      const res = await autenticarLojista(emailLimpo, senhaLimpa);
      if (res.sucesso && res.lojista) {
        const slug = res.lojista.slug || res.lojista.id;
        localStorage.setItem('boomii_active_lojista', slug);
        localStorage.removeItem('boomii_admin_session');
        if (onSelectStore) {
          onSelectStore(slug);
        }
        setTimeout(() => {
          onNavigate('painel');
        }, 300);
        return;
      }

      setErrorMsg(res.erro || 'E-mail ou senha incorretos. Verifique suas credenciais de lojista.');
    } catch (err: any) {
      setErrorMsg(`Erro ao conectar ao Firebase: ${err.message || 'Tente novamente.'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    // Tela cheia: esta página é renderizada sem cabeçalho nem rodapé, então não
    // há mais os 140px que antes eram descontados da altura.
    <div className="relative min-h-screen flex items-center justify-center px-4 py-12">
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
            <span>Portal Seguro BOOMII</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Acesso ao Sistema
          </h1>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            Entre com suas credenciais para gerenciar lojas, clientes ou a administração de contas.
          </p>
        </div>

        {/* Main Login Form */}
        <form onSubmit={handleLogin} className="surface-panel p-8 space-y-5 rounded-2xl border border-border/60 shadow-2xl">
          <div className="space-y-1 pb-1 border-b border-border/60">
            <h2 className="text-lg font-semibold text-foreground">Entrar com credenciais</h2>
            <p className="text-xs text-muted-foreground">
              Acesso exclusivo para administradores e lojistas cadastrados no Firebase.
            </p>
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium flex items-start gap-2.5 animate-fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {avisoMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium flex items-start gap-2.5 animate-fade-in">
              <MailCheck className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{avisoMsg}</span>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="label-eyebrow block mb-1.5">
                E-mail de Acesso
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
                  onClick={handleRedefinirSenha}
                  disabled={enviandoReset}
                  className="text-[11px] font-semibold text-primary hover:underline cursor-pointer bg-transparent border-0 p-0 disabled:opacity-50 disabled:cursor-wait"
                >
                  {enviandoReset ? 'Enviando...' : 'Esqueci minha senha'}
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  id="senha"
                  type={mostrarSenha ? 'text' : 'password'}
                  required
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="Digite sua senha"
                  className="w-full rounded-xl border border-input bg-background pl-10 pr-11 py-2.5 text-sm text-foreground outline-none focus:border-primary transition-colors"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setMostrarSenha(!mostrarSenha)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                >
                  {mostrarSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
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
            className="btn-boomii w-full py-3 text-sm font-bold flex items-center justify-center gap-2 cursor-pointer shadow-xl disabled:opacity-50"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Autenticando...</span>
              </>
            ) : (
              <>
                <span>Acessar Painel</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
