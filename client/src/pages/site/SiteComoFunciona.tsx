import React from 'react';
import { SiteNavTab } from '../../components/SiteHeader.js';

interface SiteComoFuncionaProps {
  onNavigate: (tab: SiteNavTab) => void;
}

const passos = [
  {
    n: "01",
    titulo: "O balconista gera o convite",
    texto:
      "Um toque na tela cria um QR válido por poucos minutos. Nada de formulário no balcão nem fila parada.",
  },
  {
    n: "02",
    titulo: "O cliente aponta a câmera",
    texto:
      "Abre uma página com o nome da sua loja, ele preenche nome, e-mail e aniversário, e pronto.",
  },
  {
    n: "03",
    titulo: "O cartão entra na carteira",
    texto:
      "Dois botões: adicionar à Apple Wallet ou à Google Wallet. Sem app, sem senha, sem portal.",
  },
  {
    n: "04",
    titulo: "Cada compra vira um selo",
    texto:
      "O balconista lê o QR do cartão e o saldo se atualiza no celular do cliente na hora. Dez selos, uma recompensa.",
  },
];

const paraLoja = [
  "Painel com clientes, selos dados e recompensas resgatadas",
  "Recompensa e número de selos definidos por você",
  "Proteção contra selo duplicado no mesmo atendimento",
  "Exportação da base de clientes quando quiser",
  "Equipe com acessos separados para operadores",
  "Relatórios de retorno e aniversariantes do mês",
];

export const SiteComoFunciona: React.FC<SiteComoFuncionaProps> = ({ onNavigate }) => {
  return (
    <div className="mx-auto max-w-6xl px-5 py-16 md:py-24">
      <span className="label-eyebrow">Como funciona</span>
      <h1 className="mt-3 max-w-2xl text-5xl leading-[1.08]">
        Do balcão à carteira em <span className="text-primary">menos de um minuto.</span>
      </h1>

      <div className="mt-14 grid gap-4 md:grid-cols-2">
        {passos.map((p) => (
          <article key={p.n} className="rounded-2xl border border-border bg-card p-8">
            <span className="text-4xl font-bold text-primary">{p.n}</span>
            <h2 className="mt-4 text-xl">{p.titulo}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{p.texto}</p>
          </article>
        ))}
      </div>

      <div className="surface-panel mt-16 p-8 md:p-12">
        <h2 className="text-3xl">O que a sua loja recebe</h2>
        <ul className="mt-6 grid gap-3 md:grid-cols-2">
          {paraLoja.map((item) => (
            <li key={item} className="flex items-start gap-3 text-sm text-muted-foreground">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
              {item}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => onNavigate('precos')}
          className="btn-mimo mt-10 cursor-pointer"
        >
          Ver planos
        </button>
      </div>
    </div>
  );
};
