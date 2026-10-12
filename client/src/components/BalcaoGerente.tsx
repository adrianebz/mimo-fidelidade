import React, { useEffect, useState } from 'react';
import { Scan, Search, Building2, Gift, Plus, RefreshCw } from 'lucide-react';
import { buscarClientesBalcao, ClienteBalcao } from '../services/boomiiWalletService.js';

interface Props {
  lojaId: string;
  unidadeNome: string;
  gerenteEmail?: string | null;
  carimbosMes: number | null;
  /** Abre o leitor (câmera) ou, com cliente, já com ele escolhido. */
  onAtender: (cliente?: ClienteBalcao) => void;
  onResgatar: (clienteId: string) => void;
}

/**
 * Terminal de balcão do gerente de filial.
 *
 * Perfil próprio, vinculado à loja, que só faz o que o balcão precisa: ler o
 * QR, achar o cliente e dar ou resgatar selos. Não mostra os dados da conta
 * principal — a busca vem do servidor só com primeiro nome, celular mascarado
 * e selos, e as regras do banco não deixam o gerente ler a base de clientes.
 */
export const BalcaoGerente: React.FC<Props> = ({ lojaId, unidadeNome, gerenteEmail, carimbosMes, onAtender, onResgatar }) => {
  const [termo, setTermo] = useState('');
  const [resultados, setResultados] = useState<ClienteBalcao[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const t = termo.trim();
    if (t.length < 2) {
      setResultados([]);
      setErro(null);
      return;
    }
    // Espera o operador parar de digitar antes de consultar o servidor.
    const id = setTimeout(async () => {
      setBuscando(true);
      const res = await buscarClientesBalcao(lojaId, t);
      setBuscando(false);
      if (res.sucesso) {
        setResultados(res.clientes);
        setErro(null);
      } else setErro(res.erro);
    }, 350);
    return () => clearTimeout(id);
  }, [termo, lojaId]);

  return (
    <div className="space-y-5 animate-fade-in max-w-xl mx-auto">
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 flex items-center gap-3">
        <div className="h-11 w-11 shrink-0 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
          <Building2 className="w-5 h-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <span className="label-eyebrow block">Unidade</span>
          <h1 className="text-xl font-black text-foreground truncate">{unidadeNome || 'Minha unidade'}</h1>
          {gerenteEmail && <p className="text-[11px] text-muted-foreground truncate">Gerente: {gerenteEmail}</p>}
        </div>
        {carimbosMes !== null && (
          <div className="text-right shrink-0">
            <span className="text-[11px] text-muted-foreground block">Selos no mês</span>
            <strong className="text-xl font-black text-foreground tabular-nums">{carimbosMes}</strong>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => onAtender()}
        className="btn-boomii w-full py-5 text-base font-black flex items-center justify-center gap-3 cursor-pointer"
      >
        <Scan className="w-6 h-6" />
        Ler QR do cliente
      </button>

      <div className="space-y-2">
        <label htmlFor="busca-balcao" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
          Ou busque o cliente
        </label>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            id="busca-balcao"
            type="search"
            autoComplete="off"
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="Nome ou final do celular"
            className="w-full rounded-2xl border border-input bg-card pl-11 pr-10 py-3 text-sm text-foreground outline-none focus:border-primary"
          />
          {buscando && <RefreshCw className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-primary" />}
        </div>

        {erro && <p className="text-xs text-rose-500">{erro}</p>}

        {resultados.length > 0 && (
          <ul className="rounded-2xl border border-border bg-card divide-y divide-border/40 overflow-hidden">
            {resultados.map((c) => {
              const pronto = c.selos >= c.meta;
              return (
                <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <span className="font-semibold text-foreground text-sm block truncate">{c.nome}</span>
                    <span className="text-xs text-muted-foreground">
                      {c.celularMascarado} · {c.selos}/{c.meta} selos
                    </span>
                  </div>
                  {pronto ? (
                    <button
                      type="button"
                      onClick={() => onResgatar(c.id)}
                      className="btn-boomii shrink-0 px-3 py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Gift className="w-3.5 h-3.5" />
                      Resgatar
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onAtender(c)}
                      className="shrink-0 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-bold text-primary flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Selos
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {termo.trim().length >= 2 && !buscando && !erro && resultados.length === 0 && (
          <p className="text-xs text-muted-foreground px-1">Nenhum cliente encontrado.</p>
        )}
      </div>
    </div>
  );
};

export default BalcaoGerente;
