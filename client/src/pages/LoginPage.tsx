import React, { useState } from 'react';
import { 
  LogIn, Eye, EyeOff, ArrowRight, ShieldCheck, 
  Store, Sparkles, Lock, CheckCircle2
} from 'lucide-react';

interface LoginPageProps {
  onLogin: (email: string, password: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('leonam.ataide@gmail.com');
  const [password, setPassword] = useState('mimo2026');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    await new Promise(resolve => setTimeout(resolve, 600));

    if (email.includes('@') && password.length >= 4) {
      onLogin(email, password);
    } else {
      setError('E-mail ou senha incorretos. Digite ao menos 4 caracteres.');
    }

    setIsLoading(false);
  };

  const handleQuickDemo = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('mimo2026');
    onLogin(demoEmail, 'mimo2026');
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4 text-slate-800 antialiased">
      <div className="w-full max-w-md space-y-6 animate-fade-in-up">
        {/* Brand header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-teal-600 text-white flex items-center justify-center font-black text-sm mx-auto shadow-sm">
            FC
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Painel do Lojista
          </h1>
          <p className="text-xs text-slate-500">
            Acesse para gerenciar cartões, clientes e campanhas
          </p>
        </div>

        {/* Login Card */}
        <div className="saas-card p-6 sm:p-8 space-y-5 shadow-xl bg-white">
          {error && (
            <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl text-rose-800 text-xs font-bold">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">
                E-mail de Acesso
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu.email@empresa.com"
                className="input-saas text-xs"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-slate-600 uppercase block">
                  Senha
                </label>
                <button
                  type="button"
                  onClick={() => alert('Para a demonstração, utilize qualquer senha com 4 dígitos (ex: mimo2026).')}
                  className="text-[11px] text-teal-600 hover:underline"
                >
                  Esqueceu a senha?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-saas text-xs pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary-teal w-full text-xs font-bold py-3 shadow-md flex items-center justify-center gap-2"
            >
              <span>{isLoading ? 'Entrando...' : 'Entrar no Painel'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Demo Logins */}
          <div className="pt-3 border-t border-slate-100 space-y-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block text-center">
              Acesso Rápido de Demonstração:
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickDemo('leonam.ataide@gmail.com')}
                className="p-2 rounded-xl border border-slate-200 hover:border-teal-400 hover:bg-teal-50/50 text-[11px] font-semibold text-slate-700 text-center transition-colors"
              >
                Lojista (NOX Club)
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemo('admin@mimo.com.br')}
                className="p-2 rounded-xl border border-slate-200 hover:border-teal-400 hover:bg-teal-50/50 text-[11px] font-semibold text-slate-700 text-center transition-colors"
              >
                Superadmin
              </button>
            </div>
          </div>
        </div>

        <div className="text-center text-[11px] text-slate-400">
          MIMO — Fidelidade em Carteira Digital • v2.0
        </div>
      </div>
    </div>
  );
};
