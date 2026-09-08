# 06 — Frontend

Linguagem visual: **Apple TV / tvOS**. Ver `09-design-system.md` para tokens,
tipografia e comportamento de foco. Este documento trata de estrutura e fluxo.

## Superfícies

| Interface | Rota | Usuário | Auth |
|-----------|------|---------|------|
| Cadastro por convite | `/entrar/:token` | Cliente | Nenhuma (token no link) |
| Balcão | `/balcao` | Balconista | Supabase Auth |
| Painel | `/admin` | Administrador | Supabase Auth + `role=admin` |

**Não existe interface de cliente além do formulário de cadastro.** Sem login de
cliente, sem portal, sem "minha conta", sem consulta de saldo. O saldo vive no
passe da carteira.

---

## 1. Cadastro — `/entrar/:token`

Única tela que o cliente vê, uma vez na vida. Acessada escaneando o QR que o
operador exibe na tela.

### Estados

**a) Validando o convite**
Tela de carregamento breve. Chama `GET /api/enroll/:token`.

**b) Formulário**

Campos, nesta ordem:
- Nome
- Sobrenome
- E-mail
- Data de nascimento
- Telefone (opcional, se a decisão Q9 for incluí-lo)
- Consentimento LGPD — checkbox nunca pré-marcado, com link para a política

Um campo por vez em telas estreitas, com progresso sutil no topo. O cliente está
de pé no balcão; formulário longo em tela única desanima.

Teclados corretos por campo: `type="email"`, `inputmode="numeric"` para a data,
`autocomplete` preenchido em todos.

**c) Sucesso — os botões aparecem sozinhos**

Requisito explícito: **ao finalizar o cadastro, a opção de adicionar à carteira
aparece automaticamente.** Sem tela intermediária, sem "clique aqui para
continuar".

```
        ✓
   Bem-vinda, Maria

   Seu cartão está pronto

  ┌───────────────────────┐
  │  Adicionar à Apple    │   ← badge oficial
  │       Wallet          │
  └───────────────────────┘
  ┌───────────────────────┐
  │  Adicionar ao Google  │   ← badge oficial
  │       Wallet          │
  └───────────────────────┘

   10 selos = 1 cookie grátis
```

- Detectar o SO e ordenar o botão correspondente primeiro
- **Exibir os dois sempre** — o detector erra e há quem use os dois
- Usar os badges oficiais da Apple e do Google. Têm regras de marca; não
  redesenhar
- Animar a entrada da tela de sucesso (fade + subida de 12px, 320ms). É o
  momento de recompensa do fluxo

**d) Convite inválido**

Expirado ou já usado. Tela calma, sem cara de erro técnico:
"Este convite expirou. Peça um novo no balcão."

### Requisitos

- Mobile-first. Praticamente 100% do tráfego é celular
- Carregar em menos de 2s em 4G
- Validar e-mail e data no cliente e no servidor
- Nunca expor o token em analytics ou logs de terceiros

---

## 2. Balcão — `/balcao`

**A interface mais usada do sistema.** Dezenas de vezes por dia, com pressa,
com fila esperando.

### Estrutura

Duas ações principais, sempre a um toque:

```
┌─────────────────────────────┐
│                             │
│      [ scanner ativo ]      │
│                             │
│  ┌───────────────────────┐  │
│  │   + NOVO CLIENTE      │  │  ← emite convite QR
│  └───────────────────────┘  │
└─────────────────────────────┘
```

### Fluxo de carimbo

```
Scanner sempre aberto  ←─────────────┐
   ↓ (lê QR do passe)                │
Tela de confirmação                  │
   ↓ (toca "Dar selo")               │
Feedback de sucesso ─────────────────┘
   (volta ao scanner em 3s)
```

Usar `@zxing/browser`. Manter a câmera ativa entre leituras — reiniciar a cada
scan deixa o fluxo lento.

### Tela de confirmação

Aparece assim que o QR é lido, **antes** de carimbar.

```
┌─────────────────────────┐
│     MARIA SILVA         │  ← nome GRANDE (antifraude)
│                         │
│      ●●●●●●●●○○         │
│         8 / 10          │  ← display 56–72px
│                         │
│   ┌─────────────────┐   │
│   │   DAR SELO      │   │  ← botão grande
│   └─────────────────┘   │
│        Cancelar         │
└─────────────────────────┘
```

**O nome em destaque não é decoração.** É como o balconista confere que o QR
pertence à pessoa na frente dele (RN7).

### Fluxo de novo cliente

1. Toque em "Novo cliente"
2. QR ocupa a tela inteira, alto contraste, com contagem regressiva de 15 min
3. Cliente escaneia com a câmera do próprio celular
4. Tela do operador detecta a conclusão (polling ou SSE) e mostra
   "Maria Silva cadastrada"
5. Volta ao scanner

O passo 4 importa: sem ele o operador fica sem saber se deu certo e a fila trava.

### Estados especiais

| Situação | Tela |
|----------|------|
| Cartão completo (10/10) | Botão vira **"ENTREGAR COOKIE"**, em `--accent-yellow` |
| Selo há menos de 3 min | Aviso em `--accent-orange`: "Selo já dado há 45 segundos" |
| Cartão não encontrado | "QR não reconhecido. Tente de novo." |
| Sem internet | Banner `--accent-red` fixo. Botão bloqueado. |
| Cliente perdeu o passe | Botão "Reenviar cartão" na busca por e-mail |

### Requisitos

- **PWA instalável** na tela de início
- Sessão de 30 dias. Ninguém quer logar toda manhã
- Área de toque mínima de 48px
- Alto contraste — iluminação de loja é imprevisível
- Gerar o `Idempotency-Key` **no momento da leitura do QR**, não no clique
- Busca por e-mail como fallback quando o QR não lê

### Modo offline — fora de escopo

Tentador, mas sem servidor não dá para validar duplicidade nem o limite de 10.
**Não implementar.** Internet caiu: anotar no papel e lançar depois pelo painel.

---

## 3. Painel — `/admin`

Aqui a linguagem tvOS aparece com força: prateleiras horizontais, cartões
grandes que crescem no foco, fundo quase preto.

### Home

Fileira de métricas em cartões, no estilo das prateleiras do Apple TV:

```
CLIENTES     SELOS (30d)   COOKIES      PERTO DO
   342           891          61        RESGATE  28
```

Números grandes (56px+), rótulos minúsculos em caixa alta com tracking positivo.

### Clientes

Tabela com busca por nome ou e-mail. Colunas: nome, e-mail, selos, ciclos,
última visita.

A�ões por linha: reenviar cartão, ajustar selos, ver histórico.
Botão **Exportar CSV** bem visível.

### Design do cartão

O construtor completo. Especificação em `09-design-system.md`, Parte B.

Layout: controles à esquerda, **preview das duas carteiras à direita, sempre
visível**, com seletor de estado (0 / 4 / 8 / 10 selos).

Rodapé fixo com "Salvar rascunho" e "Publicar", com o aviso de quantos clientes
serão afetados.

### Funcionários

Adicionar, desativar, ver quantos selos cada um deu no mês. Ferramenta de
auditoria do RN7.

### Não construir agora

Gráficos elaborados, dashboards em tempo real, segmentação, construtor de
campanhas.

---

## Acessibilidade

- Contraste AA em todo texto — inclusive nos designs que o admin criar
  (validado no construtor)
- `<label>` de verdade em todo campo
- Botão de carimbo alcançável por teclado
- Estado nunca indicado só por cor: o aviso de "selo recente" precisa de texto
- `prefers-reduced-motion`: manter o brilho de foco, remover a escala
