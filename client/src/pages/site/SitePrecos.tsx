import React from 'react';
import { SiteNavTab } from '../../components/SiteHeader.js';

interface SitePrecosProps {
  onNavigate: (tab: SiteNavTab) => void;
}

const planos = [
  {
    nome: "Balcão",
    preco: "R$ 89",
    resumo: "Para uma loja começar hoje.",
    itens: [
      "1 loja e 2 operadores",
      "Clientes ilimitados",
      "Apple Wallet e Google Wallet",
      "Painel com selos e resgates",
      "Suporte por e-mail",
    ],
    destaque: false,
  },
  {
    nome: "Rede",
    preco: "R$ 189",
    resumo: "Para quem tem mais de um ponto.",
    itens: [
      "Até 5 unidades e operadores ilimitados",
      "Cartão com a identidade da sua marca",
      "Campanha de aniversário",
      "Relatórios de retorno",
      "Suporte prioritário no WhatsApp",
    ],
    destaque: true,
  },
  {
    nome: "Marca",
    preco: "Sob medida",
    resumo: "Para franquias e operações grandes.",
    itens: [
      "Unidades ilimitadas",
      "Assinatura Mimo removida do cartão",
      "Integração com o seu sistema de caixa",
      "Ambiente de testes dedicado",
      "Gerente de conta",
    ],
    destaque: false,
  },
];

export const SitePrecos: React.FC<SitePrecosProps> = ({ onNavigate }) => {
  return (
    <div className="mx-auto max-w-6xl px-5 py-16 md:py-24">
      <span className="label-eyebrow">Planos</span>
      <h1 className="mt-3 max-w-2xl text-5xl leading-[1.08]">
        Preço por loja. <span className="text-primary">Nunca por cliente.</span>
      </h1>
      <p className="mt-5 max-w-lg text-muted-foreground">
        Programas que cobram por pacote de clientes punem o crescimento que o programa deveria
        gerar. Aqui a conta é a mesma com 100 ou com 10.000 cadastrados.
      </p>

      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {planos.map((p) => (
          <article
            key={p.nome}
            className={`flex flex-col rounded-2xl border p-8 ${
              p.destaque
                ? "border-primary/60 bg-card shadow-[var(--shadow-glow)]"
                : "border-border bg-card"
            }`}
          >
            {p.destaque && <span className="label-eyebrow text-primary">Mais escolhido</span>}
            <h2 className="mt-1 text-xl">{p.nome}</h2>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-4xl font-bold">{p.preco}</span>
              {p.preco.startsWith("R$") && (
                <span className="text-sm text-muted-foreground">/mês</span>
              )}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{p.resumo}</p>
            <ul className="mt-6 flex-1 space-y-3">
              {p.itens.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-muted-foreground">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  {item}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => onNavigate('contato')}
              className={`mt-8 cursor-pointer ${p.destaque ? "btn-mimo" : "btn-mimo-ghost hover:bg-secondary"}`}
            >
              {p.preco === "Sob medida" ? "Falar com vendas" : "Assinar"}
            </button>
          </article>
        ))}
      </div>

      <p className="mt-8 text-xs text-muted-foreground">
        Valores de exemplo para você ajustar. Diga quais preços quer praticar e eu atualizo.
      </p>
    </div>
  );
};
