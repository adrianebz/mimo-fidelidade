import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { Sparkles, ShieldCheck, CheckCircle2, AlertTriangle, ArrowRight, Smartphone } from 'lucide-react';
import { WalletBadges } from '../components/WalletBadges.js';
import { PassPreview } from '../components/PassPreview.js';
import * as mock from '../services/mockData.js';

interface CustomerEnrollProps {
  tokenProp?: string;
}

export const CustomerEnroll: React.FC<CustomerEnrollProps> = ({ tokenProp }) => {
  const pathToken = window.location.pathname.split('/entrar/')[1] || window.location.pathname.split('/enroll/')[1];
  const activeToken = tokenProp || pathToken || 'demo_invite_token';

  const storeInfo = {
    store_name: 'NOX Dessert Club',
    reward_label: 'Cookie Grátis',
    valid: true
  };

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    birthDate: '',
    consent: true
  });

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [enrolledCard, setEnrolledCard] = useState<any | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!formData.consent) {
      setErrorMsg('É obrigatório aceitar os termos para emissão do cartão.');
      return;
    }

    setIsLoading(true);

    try {
      const data = await mock.enrollCustomer({
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone || undefined,
      });

      confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });
      setEnrolledCard(data);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center px-4 py-8 antialiased text-slate-800">
      <div className="max-w-md w-full">
        {enrolledCard ? (
          /* Enrollment Completed View */
          <div className="saas-card p-6 sm:p-8 space-y-6 text-center animate-fade-in-up">
            <div className="w-16 h-16 rounded-full bg-emerald-50 border-2 border-emerald-500 flex items-center justify-center mx-auto text-emerald-600 shadow-md">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-teal-600">
                CADASTRO CONCLUÍDO!
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
                Seu Cartão Está Pronto
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 mt-2">
                Adicione agora mesmo à carteira do seu smartphone para acumular selos e resgatar{' '}
                <strong className="text-slate-900">{enrolledCard.rewardLabel}</strong>.
              </p>
            </div>

            {/* Official Wallet Badges */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
              <WalletBadges
                cardSerial={enrolledCard.cardSerial}
                applePassUrl={enrolledCard.applePassUrl}
                googleSaveUrl={enrolledCard.googleSaveUrl}
              />
            </div>

            {/* Live Pass Preview */}
            <div className="pt-2">
              <PassPreview
                storeName={enrolledCard.storeName || storeInfo.store_name}
                customerName={enrolledCard.customerName || `${formData.firstName} ${formData.lastName}`}
                stamps={0}
                required={10}
                rewardLabel={enrolledCard.rewardLabel || storeInfo.reward_label}
                serial={enrolledCard.cardSerial}
              />
            </div>

            <div className="text-[11px] text-slate-400">
              Não precisa de senha ou download de app. O cartão vive na sua Apple Wallet ou Google Wallet.
            </div>
          </div>
        ) : (
          /* Enrollment Form View */
          <div className="saas-card p-6 sm:p-8 space-y-6 shadow-xl animate-fade-in">
            {/* Store Brand Header */}
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-teal-600 text-white flex items-center justify-center font-black text-sm mx-auto shadow-sm">
                FC
              </div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900">
                {storeInfo.store_name}
              </h2>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-xs font-bold">
                <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                <span>Programa de Fidelidade Digital</span>
              </div>
              <p className="text-xs text-slate-500 max-w-xs mx-auto pt-1">
                Junte 10 selos a cada visita e ganhe{' '}
                <strong className="text-slate-800">{storeInfo.reward_label}</strong> direto na sua carteira.
              </p>
            </div>

            {errorMsg && (
              <div className="bg-rose-50 border border-rose-300 p-3 rounded-xl text-rose-900 text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">
                    Nome *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    placeholder="Ex: Maria"
                    className="input-saas text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">
                    Sobrenome *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    placeholder="Ex: Silva"
                    className="input-saas text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">
                  E-mail *
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="seu.email@exemplo.com"
                  className="input-saas text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">
                  WhatsApp (Opcional)
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(11) 99999-9999"
                  className="input-saas text-xs"
                />
              </div>

              <div className="pt-2">
                <label className="flex items-start gap-2.5 cursor-pointer text-left">
                  <input
                    type="checkbox"
                    checked={formData.consent}
                    onChange={(e) => setFormData({ ...formData, consent: e.target.checked })}
                    className="mt-0.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  />
                  <span className="text-[11px] text-slate-500 leading-tight">
                    Concordo em receber meu cartão de fidelidade digital e comunicações da loja conforme a LGPD.
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary-teal w-full text-xs sm:text-sm font-bold py-3.5 shadow-md flex items-center justify-center gap-2"
              >
                <span>{isLoading ? 'Gerando Cartão...' : 'Criar e Salvar na Carteira'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
              <span>Dados protegidos • Compatível com Apple e Google</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
