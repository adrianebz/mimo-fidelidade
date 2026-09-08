import React from 'react';
import mascote from '../../assets/mascote-hero.jpg';
import carteira from '../../assets/carteira-mockup.jpg';
import { SiteNavTab } from '../../components/SiteHeader.js';

interface SiteHomeProps {
  onNavigate: (tab: SiteNavTab) => void;
}

function Stamps({ filled = 8, total = 10 }: { filled?: number; total?: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`h-3.5 w-3.5 rounded-full ${i < filled ? "bg-primary" : "bg-muted"}`}
        />
      ))}
      <span className="ml-2 text-sm font-semibold">
        {filled}/{total}
      </span>
    </div>
  );
}

const beneficios = [
  {
    titulo: "Zero atrito no balcão",
    texto:
      "O operador gera um QR, o cliente aponta a câmera e o cartão entra na carteira. Selo dado em segundos.",
  },
  {
    titulo: "Sem app, sem senha",
    texto:
      "Seu cliente não baixa nada e não cria conta. O cartão vive na carteira que ele já abre para pagar.",
  },
  {
    titulo: "A base é sua",
    texto:
      "Clientes, aniversários e histórico de selos ficam com a loja, exportáveis a qualquer momento.",
  },
  {
    titulo: "Preço que não pune crescimento",
    texto: "Mensalidade fixa por loja. Cadastrar mais clientes não aumenta a sua conta.",
  },
  {
    titulo: "Sua marca, sempre",
    texto:
      "Na carteira do consumidor aparece o nome e o visual da sua loja — a Mimo fica nos bastidores.",
  },
  {
    titulo: "Notificação que traz de volta",
    texto:
      "A cada selo o cartão se atualiza sozinho no celular, com o aviso saindo em nome da sua loja.",
  },
];

export const SiteHome: React.FC<SiteHomeProps> = ({ onNavigate }) => {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute -top-40 right-0 h-[420px] w-[420px] rounded-full opacity-20 blur-3xl"
          style={{ background: "var(--gradient-yellow)" }}
        />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 md:grid-cols-2 md:py-24">
          <div>
            <span className="label-eyebrow">Simples. Moderno. Na carteira.</span>
            <h1 className="mt-4 text-5xl leading-[1.05] md:text-6xl">
              Seu cliente <span className="text-primary">sempre com você.</span>
            </h1>
            <p className="mt-5 max-w-md text-lg text-muted-foreground">
              A Mimo coloca o cartão de fidelidade da sua loja dentro da Apple Wallet e da Google
              Wallet. Dez selos, uma recompensa, nenhum aplicativo para o cliente instalar.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => onNavigate('contato')}
                className="btn-mimo cursor-pointer"
              >
                Quero para minha loja
              </button>
              <button
                type="button"
                onClick={() => onNavigate('como-funciona')}
                className="btn-mimo-ghost hover:bg-secondary cursor-pointer"
              >
                Ver como funciona
              </button>
            </div>
            <p className="mt-6 text-sm text-muted-foreground">
              Sem cobrança por pacote de clientes · Implantação em uma semana
            </p>
          </div>

          <div className="relative">
            <img
              src={mascote}
              alt="Mascote da Mimo segurando um celular com o cartão de fidelidade"
              width={1024}
              height={1024}
              className="mx-auto w-full max-w-md rounded-3xl object-cover"
            />
          </div>
        </div>
      </section>

      {/* Cartão demo */}
      <section className="mx-auto max-w-6xl px-5 pb-20">
        <div className="surface-panel grid gap-10 p-8 md:grid-cols-2 md:p-12">
          <div>
            <span className="label-eyebrow">O que o cliente vê</span>
            <h2 className="mt-3 text-3xl">Um cartão da sua loja, não da Mimo.</h2>
            <p className="mt-4 text-muted-foreground">
              O nome, as cores e a recompensa são definidos por você. A cada compra o saldo muda
              sozinho no celular do cliente.
            </p>

            <div className="mt-8 rounded-2xl border border-border bg-background p-6">
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold">Padaria da Esquina</span>
                <span className="label-eyebrow">Selos</span>
              </div>
              <div className="mt-5">
                <Stamps />
              </div>
              <p className="mt-5 text-sm text-muted-foreground">
                Faltam só 2 para o seu café grátis.
              </p>
            </div>
          </div>

          <img
            src={carteira}
            alt="Celular exibindo o cartão de fidelidade dentro da carteira digital"
            loading="lazy"
            width={1024}
            height={1024}
            className="w-full rounded-2xl object-cover"
          />
        </div>
      </section>

      {/* Benefícios */}
      <section className="mx-auto max-w-6xl px-5 pb-20">
        <span className="label-eyebrow">Por que Mimo</span>
        <h2 className="mt-3 max-w-xl text-4xl">
          Fidelidade que faz seu cliente <span className="text-primary">voltar.</span>
        </h2>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {beneficios.map((b) => (
            <article
              key={b.titulo}
              className="rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/40"
            >
              <h3 className="text-lg">{b.titulo}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{b.texto}</p>
            </article>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-5 pb-24">
        <div className="surface-panel flex flex-col items-center gap-6 p-12 text-center">
          <h2 className="max-w-xl text-4xl">
            Mais que pontos. <span className="text-primary">Mimos.</span>
          </h2>
          <p className="max-w-md text-muted-foreground">
            Conte um pouco sobre a sua loja e montamos o seu programa de fidelidade.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('contato')}
            className="btn-mimo cursor-pointer"
          >
            Começar agora
          </button>
        </div>
      </section>
    </>
  );
};
