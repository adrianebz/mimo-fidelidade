import React from 'react';
import { SiteNavTab } from '../../components/SiteHeader.js';
import { PRECO_PLANO, PRECO_UNIDADE_EXTRA } from '../../planos.js';

interface SitePrecosProps {
  onNavigate: (tab: SiteNavTab) => void;
}

type Item = { texto: string; emBreve?: boolean };

// Só o que existe de verdade; o que ainda está sendo construído vem marcado
// "em breve" — promessa sem recurso por trás vira cancelamento depois.
const planos: Array<{ nome: string; preco: string; resumo: string; itens: Item[]; destaque: boolean }> = [
  {
    nome: "Essencial",
    preco: `R$ ${PRECO_PLANO.essencial}`,
    resumo: "O cartão de papel, agora na carteira do celular.",
    itens: [
      { texto: "Clientes ilimitados" },
      { texto: "Cartão na Apple Wallet e na Google Wallet" },
      { texto: "Painel e app para iPhone e Android" },
      { texto: "Cadastro por link e QR no balcão" },
      { texto: "Leitura de QR e busca de cliente, 1 selo por leitura" },
      { texto: "Cartão com o seu nome, logo e cores" },
      { texto: "Aviso de prêmio liberado na carteira" },
      { texto: "Suporte por e-mail" },
    ],
    destaque: false,
  },
  {
    nome: "Pro",
    preco: `R$ ${PRECO_PLANO.pro}`,
    resumo: "O cartão que traz o cliente de volta sozinho.",
    itens: [
      { texto: "Tudo do Essencial" },
      { texto: "Avisos automáticos: novo selo, quase lá e lembrete de prêmio" },
      { texto: "Aniversário com selo de presente" },
      { texto: "Textos dos avisos com a voz da sua loja" },
      { texto: "Estúdio de Marca completo: ícones e imagens dos selos" },
      { texto: "Vários selos por compra" },
      { texto: "Indicadores de retorno e progresso dos cartões" },
      { texto: "Ficha de cada cliente com o histórico de visitas" },
      { texto: "Suporte no WhatsApp" },
    ],
    destaque: true,
  },
  {
    nome: "Completo",
    preco: `R$ ${PRECO_PLANO.completo}`,
    resumo: "Para operar e crescer com equipe e dados.",
    itens: [
      { texto: "Tudo do Pro" },
      { texto: `Filiais: 1 unidade inclusa, + R$ ${PRECO_UNIDADE_EXTRA}/mês por unidade extra` },
      { texto: "Gerente de filial com acesso próprio" },
      { texto: "Planilha com as métricas de cada cliente" },
      { texto: "Itens Fixos: o que cada cliente compra e os mais vendidos" },
      { texto: "Campanhas para grupos de clientes", emBreve: true },
      { texto: "Cartão sem a marca Boomii", emBreve: true },
      { texto: "Seu cartão criado pela nossa equipe" },
      { texto: "Suporte prioritário no WhatsApp" },
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
                <li key={item.texto} className="flex items-start gap-3 text-sm text-muted-foreground">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  <span>
                    {item.texto}
                    {item.emBreve && (
                      <span className="ml-1.5 rounded-full border border-primary/40 px-1.5 py-px text-[10px] font-semibold text-primary align-middle">
                        em breve
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => onNavigate('contato')}
              className={`mt-8 cursor-pointer ${p.destaque ? "btn-boomii" : "btn-boomii-ghost hover:bg-secondary"}`}
            >
              Assinar
            </button>
          </article>
        ))}
      </div>

      <p className="mt-8 text-xs text-muted-foreground">
        Plano anual com 2 meses grátis. Troque de plano quando quiser: o upgrade vale na hora.
      </p>
    </div>
  );
};
