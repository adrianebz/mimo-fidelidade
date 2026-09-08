# 10 — Marca Mimo

**Mimo — Fidelidade Digital** é a marca da plataforma. Este documento trata de
como ela convive com a marca de cada lojista, porque num SaaS multiempresa isso
não é detalhe cosmético: define o que o consumidor final vê na carteira.

---

## 1. Duas marcas, dois territórios

O erro mais caro que se pode cometer aqui é deixar a marca Mimo aparecer onde
deveria estar a marca do lojista.

Os mockups da identidade mostram o cartão da carteira com o logotipo Mimo. Isso
funciona para material de venda — o público ali é o lojista. **Não funciona no
produto.** O cliente da padaria adiciona o cartão *da padaria*. Se abrir a
carteira e vir "Mimo", ele não reconhece, e o lojista perde exatamente o ativo
de marca que o programa deveria reforçar.

### Regra de território

| Superfície | Quem aparece | Observação |
|---|---|---|
| Site institucional, material de venda | **Mimo** | Público é o lojista |
| Painel da plataforma (admin Mimo) | **Mimo** | Uso interno |
| Painel do lojista | **Mimo** na moldura, **lojista** no conteúdo | Ele sabe que usa Mimo |
| PWA de balcão | **Lojista** dominante | O balconista trabalha para a loja |
| Formulário de cadastro do consumidor | **Lojista** dominante | Assinatura Mimo discreta no rodapé |
| **Cartão na carteira** | **Lojista, sempre** | Ver seção 2 |
| Notificação da carteira | **Lojista** | Ver nota técnica abaixo |

### Assinatura discreta

Onde a Mimo aparece secundariamente, usar apenas: `Fidelidade por Mimo` em
texto pequeno, ou o símbolo do sorriso a 16px. Nunca o logotipo completo com
assinatura "FIDELIDADE DIGITAL" numa superfície do lojista.

> **Decisão pendente (Q11):** o lojista pode remover a assinatura Mimo? É a
> pergunta de white-label. Costuma virar item de plano pago. Registrar a decisão
> antes de construir o construtor de design — muda o modelo de dados da config.

---

## 2. Nota técnica: as carteiras permitem marca por lojista

Confirmado que a arquitetura suporta a regra acima:

**Apple Wallet.** O `organizationName` do `pass.json` é por passe, não por
certificado. Ele é o nome que aparece nas notificações e nos ajustes do iPhone.
Preencher com o nome do lojista, não "Mimo". O `passTypeIdentifier` continua
sendo da Mimo — isso é invisível ao consumidor.

**Google Wallet.** O `issuerName` fica na `LoyaltyClass`, e há uma classe por
organização. Preencher com o nome do lojista.

> Consequência importante: a notificação no iPhone vai dizer o nome do lojista.
> É o comportamento correto, e é o que justifica ter uma classe por organização
> em vez de uma classe global.

---

## 3. Tokens de marca

### Conflito a resolver antes de codificar

Os dois materiais de identidade trazem **paletas diferentes**. Só o verde bate.

| Cor | Material 1 | Material 2 | Situação |
|---|---|---|---|
| Grafite | `#080B0B` | `#0F0F10` | **divergente** |
| Amarelo | `#FFC828` | `#FFC82C` | **divergente** |
| Off-white | `#77F7F5` | `#F7F5EF` | **divergente** — o primeiro parece erro de transcrição (é um ciano, não um off-white) |
| Cinza | `#8A8A8A` | `#8ABABF` | **divergente** — neutro vs. cinza-azulado |
| Verde | `#16A34A` | `#16A34A` | ✅ único consenso |

**Não começar o desenvolvimento sem fechar isso.** Cor de marca espalhada em
CSS, imagens geradas, `backgroundColor` do passe e `hexBackgroundColor` do
Google é dolorosa de corrigir depois — cada mudança republica todos os passes de
todos os lojistas.

Enquanto não houver decisão, o pacote adota o **Material 2** (o que traz nomes
próprios para as cores, sinal de ser o mais recente):

```css
--mimo-graphite:  #0F0F10;   /* fundo padrão */
--mimo-offwhite:  #F7F5EF;   /* superfície clara */
--mimo-yellow:    #FFC82C;   /* acento, marca */
--mimo-green:     #16A34A;   /* sucesso, selo confirmado */
--mimo-gray:      #8ABABF;   /* texto secundário sobre escuro */
```

> `#16A34A` é exatamente o verde 600 do Tailwind. Coincidência provável, não
> problema — mas convém saber que a cor não é proprietária.

### Uso do amarelo

O amarelo é o acento da marca, não uma cor de superfície. Sobre grafite ele
funciona; como fundo de bloco grande cansa a vista e derruba o contraste do
texto preto em telas com brilho baixo.

Regra: amarelo em botão primário, badge de recompensa, selo preenchido e
detalhes. Nunca como fundo de tela inteira na PWA de balcão, que é usada o dia
todo.

### Verde tem função, não é decoração

`#16A34A` fica reservado para **confirmação de selo registrado**. Se virar cor
decorativa, perde o significado justamente na tela onde o balconista precisa de
um sinal inequívoco em meio segundo.

---

## 4. Tipografia

**Montserrat Rounded**, pesos Bold, SemiBold, Medium e Regular.

### Três avisos

**a) A carteira não aceita fonte customizada.** Nem Apple nem Google permitem
trocar a tipografia do passe — usam a fonte do sistema (SF Pro no iOS, Roboto no
Android). Montserrat Rounded se aplica a: site, painéis, PWA de balcão,
formulário de cadastro e **a imagem gerada da grade de selos**. No passe em si,
não.

**b) Verificar a licença antes de embutir.** "Montserrat Rounded" não é uma
família oficial do Google Fonts — o Montserrat original é SIL OFL, mas as
variantes arredondadas em circulação têm origens e licenças diversas. Como a
fonte vai ser **embutida no servidor** para gerar imagens de um produto
comercial vendido a terceiros, confirmar o arquivo exato e o direito de uso.
É o tipo de pendência que só aparece quando o produto já tem clientes.

**c) Embutir, não referenciar.** O gerador de imagem roda em container sem
fontes instaladas. Texto do badge precisa ser convertido em `<path>` SVG ou a
fonte embutida em base64. Referenciar por nome renderiza quadrados.

### Escala

A identidade Mimo é arredondada e amigável; o design system tvOS (`09`) é seco e
contrastado. Eles convivem assim: **a estrutura vem do tvOS, a voz vem da
Mimo.** Fundo quase preto, hierarquia ampla, foco que cresce — mas com
Montserrat Rounded no lugar de SF Pro, e amarelo Mimo no lugar do dourado.

Substituir na tabela tipográfica de `09-design-system.md`:
- Família: `"Montserrat Rounded", "Montserrat", system-ui, sans-serif`
- Pesos: 700 (display), 600 (títulos), 500 (rótulos), 400 (corpo)
- Manter as escalas e o tracking já definidos

---

## 5. O mascote

Bem construído e útil, mas com limites claros de onde cabe.

### Onde usa
- Site institucional e material de venda
- Tela de sucesso do cadastro (o momento de recompensa do fluxo)
- Estados vazios do painel
- Confirmação de resgate na PWA — é o momento de celebração

### Onde não usa
- **No passe da carteira.** O espaço é do lojista (seção 1), e a faixa tem
  1125×432px inteiramente ocupados pela grade de selos.
- **Na tela de scanner do balcão.** Uso repetido dezenas de vezes por dia; um
  personagem sorrindo a cada leitura vira ruído em uma semana.
- **Em erro ou aviso.** Mascote sorridente ao lado de "sem internet" soa
  desdenhoso.

### Peso dos arquivos
São renders 3D. Otimizar antes de servir: WebP, com PNG de fallback, e nunca
acima de 150KB. A PWA de balcão precisa carregar rápido em 4G de loja.

---

## 6. O selo

Decisão de forma a tomar. Três caminhos:

| Opção | Vantagem | Risco |
|---|---|---|
| **Sorriso Mimo** (o arco amarelo) | Reforça a marca da plataforma | Marca errada no território do lojista (seção 1) |
| **Círculo amarelo neutro** | Simples, legível a 156px, funciona para qualquer lojista | Genérico |
| **Configurável pelo lojista** | Padaria usa pão, cafeteria usa xícara | Mais trabalho no construtor; lojista pode escolher algo ilegível |

**Recomendação:** círculo amarelo neutro como padrão, com upload opcional no
construtor. O sorriso Mimo fica fora do cartão, coerente com a seção 1.

Estado vazio: contorno em `--mimo-gray` a 30% sobre o fundo do cartão.
Estado de recompensa: badge amarelo com o texto configurado pelo lojista.

---

## 7. Nome do produto nos documentos

O pacote foi escrito para uma loja única chamada "Dessert Club". Com a virada
para SaaS multiempresa e a marca Mimo, a nomenclatura passa a ser:

| Antes | Agora |
|---|---|
| Dessert Club (a loja) | **organização** / lojista — dado, não constante |
| "a plataforma" | **Mimo** |
| `stores/{storeId}` na raiz | `organizations/{orgId}/stores/{storeId}` |
| "administrador" | **owner do lojista** (≠ admin da plataforma Mimo) |

`Dessert Club` continua útil como **dado de exemplo** nos payloads da API e nos
seeds de teste. Não substituir nos exemplos — só deixar claro que é exemplo.

---

## 8. Pendências desta seção

| # | Pendência | Bloqueia |
|---|---|---|
| Q11 | Lojista pode remover a assinatura Mimo? | Modelo de dados da config de design |
| Q12 | Qual paleta é a canônica? | Todo o CSS e a geração de imagens |
| Q13 | Qual arquivo de Montserrat Rounded, e sob qual licença? | Gerador de imagem, uso comercial |
| Q14 | Selo padrão: círculo neutro ou sorriso Mimo? | Gerador de imagem, construtor |

Q12 e Q13 são bloqueantes para a Fase 1. Q11 e Q14 podem ser decididas até a
Fase 5.
