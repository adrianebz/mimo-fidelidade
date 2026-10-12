import React, { useState } from 'react';
import { Plus, Edit3, Pause, Play, Trash2, X, RefreshCw, AlertCircle, Check, Store, ShoppingBag } from 'lucide-react';
import {
  ListaItens,
  ItemLoja,
  salvarItem,
  excluirItem,
  definirModalidade,
} from '../services/boomiiWalletService.js';

interface Props {
  lojaId: string;
  lista: ListaItens | null;
  carregando: boolean;
  onMudou: () => void;
  onToast: (msg: string) => void;
}

const CAMPO =
  'w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-primary transition-colors';

function reais(v: number | null): string {
  return v === null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Itens Fixos (plano Completo): o lojista cadastra o cardápio que conta selo
 * e, no balcão, marca os itens da compra antes de ler o QR — uma leitura por
 * compra. É o que permite saber o que foi vendido (Mais Vendidos, produto
 * favorito do cliente).
 */
export const ItensPainel: React.FC<Props> = ({ lojaId, lista, carregando, onMudou, onToast }) => {
  const [formulario, setFormulario] = useState<{ item?: ItemLoja } | null>(null);
  const [mudandoModo, setMudandoModo] = useState(false);
  const itens = lista?.itens || [];
  const modalidade = lista?.modalidade || 'geral';

  const trocarModo = async (novo: 'geral' | 'itens') => {
    if (novo === modalidade || mudandoModo) return;
    setMudandoModo(true);
    const res = await definirModalidade(lojaId, novo);
    setMudandoModo(false);
    if (!res.sucesso) return onToast(res.erro);
    onToast(
      novo === 'itens'
        ? 'Itens Fixos ativado: no balcão, marque os itens da compra e leia o QR uma vez.'
        : 'Vendas Gerais ativado: cada leitura credita os selos escolhidos no leitor.'
    );
    onMudou();
  };

  const alternar = async (item: ItemLoja) => {
    const res = await salvarItem(lojaId, { ...item, ativo: !item.ativo }, item.id);
    if (!res.sucesso) return onToast(res.erro);
    onToast(item.ativo ? `${item.nome} pausado.` : `${item.nome} ativado.`);
    onMudou();
  };

  const apagar = async (item: ItemLoja) => {
    if (!window.confirm(`Excluir "${item.nome}"?`)) return;
    const res = await excluirItem(lojaId, item.id);
    if (!res.sucesso) return onToast(res.erro);
    onToast('Item excluído.');
    onMudou();
  };

  const Modo: React.FC<{ id: 'geral' | 'itens'; titulo: string; resumo: string; texto: string; Icone: typeof Store }> = ({
    id,
    titulo,
    resumo,
    texto,
    Icone,
  }) => {
    const ativo = modalidade === id;
    return (
      <button
        type="button"
        onClick={() => trocarModo(id)}
        disabled={mudandoModo}
        aria-pressed={ativo}
        className={`text-left rounded-2xl border p-4 sm:p-5 transition-colors cursor-pointer disabled:opacity-60 ${
          ativo ? 'border-primary bg-primary/10' : 'border-border/60 bg-card hover:border-border'
        }`}
      >
        <div className="flex items-start gap-3">
          <div className={`h-10 w-10 shrink-0 rounded-xl flex items-center justify-center ${ativo ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
            <Icone className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-foreground">{titulo}</span>
              {ativo && <Check className="w-4 h-4 text-primary shrink-0" />}
            </div>
            <span className="text-xs text-muted-foreground block">{resumo}</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-3 leading-relaxed">{texto}</p>
      </button>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <span className="label-eyebrow text-primary">Regras do programa</span>
          <h1 className="text-3xl font-black text-foreground tracking-tight mt-1">Itens Participantes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Escolha se qualquer compra dá selo ou se cada produto vendido é registrado.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFormulario({})}
          className="btn-boomii shrink-0 px-5 py-3 text-sm font-bold flex items-center justify-center gap-2 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Novo item</span>
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Modo
          id="geral"
          titulo="Vendas Gerais"
          resumo="Qualquer compra gera selo"
          texto="O operador lê o QR e escolhe quantos selos a compra vale. Rápido, mas não registra o que foi vendido."
          Icone={Store}
        />
        <Modo
          id="itens"
          titulo="Itens Fixos"
          resumo="Cada produto vendido é registrado"
          texto="O operador marca os itens da compra (ex.: 3 cookies) e lê o QR uma vez. Os selos saem do cadastro abaixo, e você vê os mais vendidos e o produto favorito de cada cliente."
          Icone={ShoppingBag}
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-foreground">Cardápio ({itens.length})</h2>
            <p className="text-xs text-muted-foreground">
              Item com 0 selo registra a venda sem pontuar (ex.: água, embalagem).
            </p>
          </div>
        </div>

        {carregando && !lista ? (
          <div className="py-10 flex justify-center">
            <RefreshCw className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : itens.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center space-y-2">
            <ShoppingBag className="w-7 h-7 text-muted-foreground mx-auto" />
            <p className="text-sm font-semibold text-foreground">Nenhum item cadastrado</p>
            <p className="text-xs text-muted-foreground">Cadastre os produtos do cardápio para usar os Itens Fixos.</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-border/60 bg-card divide-y divide-border/40">
            {itens.map((item) => (
              <div key={item.id} className={`flex items-center gap-3 px-4 py-3 min-w-0 ${item.ativo ? '' : 'opacity-60'}`}>
                <div className="min-w-0 flex-1">
                  <span className="font-semibold text-foreground text-sm block truncate">
                    {item.nome}
                    {!item.ativo && <span className="ml-2 text-[10px] font-bold text-muted-foreground">PAUSADO</span>}
                  </span>
                  <span className="text-xs text-muted-foreground block truncate">
                    {item.categoria} · {reais(item.preco)} · {item.selos} {item.selos === 1 ? 'selo' : 'selos'} ·{' '}
                    {item.vendasMes} {item.vendasMes === 1 ? 'vendido' : 'vendidos'} no mês
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setFormulario({ item })}
                    aria-label={`Editar ${item.nome}`}
                    className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => alternar(item)}
                    aria-label={item.ativo ? `Pausar ${item.nome}` : `Ativar ${item.nome}`}
                    title={item.ativo ? 'Pausar (some do balcão, mantém o histórico)' : 'Ativar'}
                    className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer"
                  >
                    {item.ativo ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  {item.vendasTotal === 0 && (
                    <button
                      type="button"
                      onClick={() => apagar(item)}
                      aria-label={`Excluir ${item.nome}`}
                      className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-secondary cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {formulario && (
        <FormularioItem
          lojaId={lojaId}
          item={formulario.item}
          categorias={[...new Set(itens.map((i) => i.categoria))]}
          onFechar={() => setFormulario(null)}
          onSalvo={() => {
            setFormulario(null);
            onToast('Item salvo.');
            onMudou();
          }}
        />
      )}
    </div>
  );
};

const FormularioItem: React.FC<{
  lojaId: string;
  item?: ItemLoja;
  categorias: string[];
  onFechar: () => void;
  onSalvo: () => void;
}> = ({ lojaId, item, categorias, onFechar, onSalvo }) => {
  const [dados, setDados] = useState({
    nome: item?.nome || '',
    categoria: item?.categoria || categorias[0] || '',
    preco: item?.preco !== null && item?.preco !== undefined ? String(item.preco).replace('.', ',') : '',
    selos: item?.selos ?? 1,
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    const res = await salvarItem(lojaId, { ...dados, ativo: item?.ativo ?? true }, item?.id);
    setSalvando(false);
    if (!res.sucesso) return setErro(res.erro);
    onSalvo();
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-background/80 backdrop-blur-sm p-0 sm:p-4 animate-fade-in"
      onClick={onFechar}
      role="dialog"
      aria-modal="true"
    >
      <form
        onSubmit={salvar}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-border bg-card shadow-2xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] space-y-3"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">{item ? `Editar ${item.nome}` : 'Novo item'}</h2>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="p-1.5 rounded-lg text-muted-foreground hover:bg-secondary cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
        {erro && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs font-medium flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{erro}</span>
          </div>
        )}
        <label className="block">
          <span className="label-eyebrow block mb-1.5">Nome</span>
          <input className={CAMPO} value={dados.nome} onChange={(e) => setDados({ ...dados, nome: e.target.value })} placeholder="Ex.: Cookie Red Velvet" required disabled={salvando} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="label-eyebrow block mb-1.5">Categoria</span>
            <input className={CAMPO} list="categorias-itens" value={dados.categoria} onChange={(e) => setDados({ ...dados, categoria: e.target.value })} placeholder="Ex.: Cookies" disabled={salvando} />
            <datalist id="categorias-itens">
              {categorias.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <label className="block">
            <span className="label-eyebrow block mb-1.5">Preço (opcional)</span>
            <input className={CAMPO} inputMode="decimal" value={dados.preco} onChange={(e) => setDados({ ...dados, preco: e.target.value })} placeholder="12,90" disabled={salvando} />
          </label>
        </div>
        <div>
          <span className="label-eyebrow block mb-1.5">Selos por unidade vendida</span>
          <div className="grid grid-cols-5 gap-2">
            {[0, 1, 2, 3, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setDados({ ...dados, selos: n })}
                className={`rounded-xl border py-2 text-sm font-bold cursor-pointer ${dados.selos === n ? 'border-primary bg-primary/10 text-primary' : 'border-border text-foreground'}`}
              >
                {n}
              </button>
            ))}
          </div>
          <span className="text-[11px] text-muted-foreground mt-1 block">0 = a venda entra no Mais Vendidos, mas não pontua.</span>
        </div>
        <button
          type="submit"
          disabled={salvando || dados.nome.trim().length < 2}
          className="btn-boomii w-full py-3 text-sm font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
        >
          {salvando ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {salvando ? 'Salvando...' : 'Salvar'}
        </button>
      </form>
    </div>
  );
};

export default ItensPainel;
