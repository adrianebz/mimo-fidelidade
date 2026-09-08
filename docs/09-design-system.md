# 09 — Design System e Construtor de Cartão

> **Leia junto com `10-marca-mimo.md`.** Este documento define a *estrutura*
> visual; a marca Mimo define a *voz*. Onde houver conflito de cor ou fonte, o
> documento de marca prevalece. Os tokens dourados abaixo foram substituídos
> pelo amarelo Mimo `#FFC82C`, e SF Pro por Montserrat Rounded nas superfícies
> web.

Referência estrutural: **Apple TV / tvOS**. Fundo quase preto, tipografia grande e
apertada, cartões arredondados com material translúcido, foco que cresce e
ilumina, cor usada com parcimônia sobre superfície escura.

---

# Parte A — Design tokens

## Cores

```css
/* Superfícies — sempre quase-preto, nunca cinza-chumbo */
--bg-base:        #000000;   /* fundo da aplicação */
--bg-elevated:    #0A0A0C;   /* painel */
--bg-card:        #16161A;   /* cartão em repouso */
--bg-card-focus:  #1F1F24;   /* cartão em foco */
--bg-material:    rgba(28,28,30,0.72);  /* + backdrop-filter: blur(30px) */

/* Traços */
--stroke-subtle:  rgba(255,255,255,0.08);
--stroke-focus:   rgba(255,255,255,0.24);

/* Texto — hierarquia por opacidade, não por cinza sólido */
--text-primary:   #FFFFFF;
--text-secondary: rgba(235,235,245,0.60);
--text-tertiary:  rgba(235,235,245,0.30);

/* Acentos (paleta dark-mode da Apple) */
--accent-blue:    #0A84FF;
--accent-yellow:  #FFD60A;   /* recompensa */
--accent-green:   #30D158;   /* sucesso, selo dado */
--accent-orange:  #FF9F0A;   /* aviso */
--accent-red:     #FF453A;   /* erro, offline */

/* Selo dourado */
--stamp-gold-hi:  #F7D774;
--stamp-gold-mid: #C9992E;
--stamp-gold-lo:  #8A6510;
--stamp-empty:    rgba(255,255,255,0.06);
```

> Gradiente do selo: `linear-gradient(145deg, #F7D774 0%, #C9992E 48%, #8A6510 100%)`
> com um brilho especular a 30% de opacidade no canto superior esquerdo.

## Tipografia

Família: **SF Pro Display** no iOS, fallback `-apple-system, "Inter", system-ui`.

O traço mais característico do tvOS é o **contraste de escala**: números enormes
ao lado de rótulos minúsculos em caixa alta.

| Papel | Tamanho | Peso | Tracking |
|-------|---------|------|----------|
| Display (contador "8/10") | 56–72px | 700 | −0.02em |
| Título de tela | 32px | 700 | −0.01em |
| Título de cartão | 22px | 600 | −0.01em |
| Corpo | 17px | 400 | 0 |
| Rótulo (SELOS, RECOMPENSAS) | 11px | 600 | **+0.08em**, uppercase |
| Legenda | 13px | 400 | 0 |

## Forma e profundidade

```css
--radius-card:   20px;
--radius-tile:   14px;
--radius-pill:   999px;

/* Sombra só em foco — em repouso o cartão é plano */
--shadow-focus: 0 18px 48px rgba(0,0,0,0.68);
--glow-focus:   0 0 0 1px rgba(255,255,255,0.18);
```

## Foco e movimento

O comportamento de foco é a assinatura do tvOS. Em web, aplicar em `:hover`,
`:focus-visible` e no item selecionado:

```css
.tile {
  transition: transform .28s cubic-bezier(.2,.7,.2,1),
              box-shadow .28s cubic-bezier(.2,.7,.2,1);
}
.tile:is(:hover, :focus-visible) {
  transform: scale(1.045) translateY(-4px);
  box-shadow: var(--shadow-focus), var(--glow-focus);
}
```

Regras:
- Escala de foco entre **1.04 e 1.06**. Acima disso parece brinquedo.
- Curva `cubic-bezier(.2,.7,.2,1)` — sai rápido, chega devagar.
- Transições entre 240ms e 320ms. Nada instantâneo, nada lento.
- Respeitar `prefers-reduced-motion`: manter o brilho, remover a escala.

## Layout

- Grades horizontais ("prateleiras") no painel, como as fileiras do Apple TV
- Espaçamento generoso: base de 8px, respiros de 24 a 48px
- Sem bordas divisórias — separar por espaço e por elevação
- Cromo mínimo: sem cabeçalho pesado, sem barra lateral cheia de ícones

---

# Parte B — Construtor de cartão (admin)

O administrador monta a aparência do próprio cartão. Antes de especificar a
ferramenta, é preciso deixar claro o que as carteiras permitem — porque a
restrição é maior do que parece.

## O que as carteiras permitem de verdade

**Nem a Apple nem o Google permitem layout livre.** Não existe canvas onde se
arrasta elementos. Cada carteira tem um layout fixo e expõe um conjunto pequeno
de variáveis.

| Elemento | Apple Wallet | Google Wallet | Editável? |
|----------|--------------|---------------|-----------|
| Cor de fundo | `backgroundColor` | `hexBackgroundColor` | **Sim** |
| Cor do texto | `foregroundColor` | derivada do fundo | **Sim (Apple)** |
| Cor do rótulo | `labelColor` | — | **Sim (Apple)** |
| Logotipo | `logo.png` | `programLogo` | **Sim** |
| Ícone | `icon.png` | — | **Sim** |
| Faixa visual | `strip.png` | `heroImage` | **Sim — é a grade de selos** |
| Textos dos campos | `headerFields` etc. | `textModulesData` | **Sim** |
| Posição dos campos | fixa | fixa | Não |
| Fonte | do sistema | do sistema | **Não** |
| Formato do cartão | fixo | fixo | Não |

**Onde está a real liberdade criativa:** na faixa visual (`strip` / `heroImage`).
É uma imagem gerada pelo servidor — ali o admin controla o desenho dos selos, o
fundo da faixa e o badge da recompensa.

> O construtor deve comunicar isso com honestidade. Prometer "desenhe seu cartão
> como quiser" e entregar seis campos gera frustração. A tela deve mostrar o
> preview real das duas carteiras lado a lado, o tempo todo.

## Controles do construtor

### 1. Identidade
- Nome do programa (aparece no topo do passe)
- Nome da organização
- Upload do logotipo — PNG/SVG com fundo transparente
  - Sistema gera automaticamente: `logo` @1x/@2x/@3x, `icon` @1x/@2x/@3x,
    `programLogo` 660×660
  - Validar: mínimo 480×150 para o logo, mínimo 660×660 para o Google

### 2. Cores
- Cor de fundo (seletor + campo hex)
- Cor do texto
- Cor dos rótulos
- **Verificação automática de contraste.** Se a combinação ficar abaixo de
  4.5:1, avisar. Cartão ilegível ao sol é o defeito mais comum.
- Presets prontos: Meia-noite, Grafite, Cacau, Creme, Dourado

### 3. Selos
- Estilo do selo cheio: Moeda dourada · Cookie · Estrela · Círculo sólido ·
  Upload próprio (SVG/PNG quadrado, mín. 200×200)
- Estilo do selo vazio: Contorno · Círculo apagado · Tracejado
- Cor de acento dos selos
- Layout da grade: 2×5 (padrão) · 1×10 · 5×2
- Fundo da faixa: transparente · sólido · gradiente

### 4. Recompensa
- Texto do badge (padrão: **COOKIE GRÁTIS**)
- Cor do badge
- Ícone opcional

### 5. Textos
- Rótulo do contador (padrão: SELOS)
- Mensagem de progresso — com variáveis `{faltam}` e `{total}`
  Ex.: `Quase lá! Faltam {faltam} selos para o seu cookie.`
- Mensagem de cartão completo
- Regulamento (verso do passe)
- Mensagem de notificação (`changeMessage`)

## Preview

Duas colunas, sempre visíveis, atualizando ao vivo:

```
┌──────────────────┬──────────────────┐
│  APPLE WALLET    │  GOOGLE WALLET   │
│  (moldura iPhone)│  (moldura Pixel) │
└──────────────────┴──────────────────┘
        Estado: [ 0 ][ 4 ][ 8 ][ 10 ]
```

O seletor de estado é obrigatório. O admin precisa ver como fica o cartão vazio,
parcial, quase cheio e completo — o erro mais comum é desenhar bonito no estado
cheio e ilegível no vazio.

Os previews precisam usar as **proporções reais** de cada carteira, não uma
aproximação estilizada.

## Versionamento e publicação

O design é versionado. Fluxo:

1. Admin edita → gera **rascunho**
2. Preview e validação
3. **Publicar** → cria uma nova versão ativa

Ao publicar:
- Regenerar as 11 imagens de grade (0 a 10 selos)
- Atualizar o `LoyaltyClass` no Google
- Marcar todos os cartões como desatualizados
- Reemitir os passes progressivamente (em lotes, não de uma vez)

**Avisos obrigatórios na tela de publicação:**
- "Isso vai atualizar o cartão de todos os N clientes"
- Cada publicação dispara notificação em todos os celulares — **não publicar
  mais de uma vez por dia**
- Mudanças no Google podem exigir novo review se alterarem o `LoyaltyClass`

Manter as 5 últimas versões, com opção de reverter.

## Validações bloqueantes

Não permitir publicar se:

- Contraste texto/fundo abaixo de 4.5:1
- Logotipo abaixo da resolução mínima
- Mensagem de progresso maior que 60 caracteres (corta na Apple)
- Nome do programa maior que 30 caracteres
- Ícone do selo fora de proporção quadrada

---

# Parte C — Especificação visual da faixa de selos

Base: `1125 × 432 px` (@3x). Derivar @2x e @1x por redução.

```
┌───────────────────────────────────────────┐
│  ●   ●   ●   ●   ●                        │  fileira 1 — 5 selos
│                                           │
│  ●   ●   ●   ○   ★                        │  fileira 2 — 4 cheios,
│                                           │  1 vazio, badge recompensa
└───────────────────────────────────────────┘
```

| Medida | Valor (@3x) |
|--------|-------------|
| Diâmetro do selo | 156px |
| Espaço horizontal | 42px |
| Espaço vertical | 36px |
| Margem lateral | 60px |
| Margem vertical | 42px |

Badge de recompensa: ocupa a 10ª posição. Em estado incompleto, exibe o texto em
duas ou três linhas sobre o círculo amarelo, com estrela no canto superior
direito. Quando o cartão completa, o badge ganha um anel externo brilhante.

**Restrição técnica:** não usar fontes do sistema na geração da imagem. Container
sem fonte instalada renderiza quadrados. Converter o texto do badge em `<path>`
SVG ou embutir a fonte em base64. Ver `02-arquitetura.md`, decisão D3.
