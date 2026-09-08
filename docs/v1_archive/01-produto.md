# 01 — Produto e Regras de Negócio

## Visão geral

Programa de fidelidade por selos para loja física. O cliente ganha 1 selo por
compra qualificada. Ao completar **10 selos, resgata um cookie grátis** e o
cartão reinicia.

O cartão vive na carteira nativa do celular (Apple Wallet / Google Wallet) e é
atualizado automaticamente, sem o cliente precisar abrir nada.

## Princípio estruturante: não existe versão de cliente

**A plataforma não tem área do cliente.** Sem login, sem app, sem portal, sem
"minha conta".

O cliente tem exatamente dois pontos de contato:

1. **O formulário de cadastro** — usado uma única vez, acessado por QR emitido
   pelo administrador
2. **O passe na carteira** — onde ele vê o saldo pelo resto da vida

Toda operação (carimbar, resgatar, corrigir, reemitir) passa pela loja. Isso é
decisão de produto, não limitação técnica.

### Consequências que precisam ser aceitas

| Consequência | Como fica |
|---|---|
| Cliente não consulta saldo fora da carteira | O passe já mostra. Suficiente. |
| Cliente não recupera o cartão sozinho | Precisa ir à loja ou pedir por e-mail. Ver F5. |
| Cliente não altera os próprios dados | Balconista ou admin altera pelo painel. |
| Cliente não se cadastra sem estar na loja | É intencional — controla quem entra. |

A mais delicada é a segunda. Sem autoatendimento, todo cliente que trocar de
celular vira um atendimento manual. Com poucos milhares de clientes é tranquilo;
vale reavaliar se o programa crescer muito.

## Atores

| Ator | Descrição | Como acessa |
|------|-----------|-------------|
| **Cliente** | Consumidor da loja | Passe na carteira. Nada mais. |
| **Balconista** | Funcionário que carimba | PWA no celular/tablet da loja |
| **Administrador** | Dono do programa | Painel web |

---

## Fluxos principais

### F1 — Cadastro por convite QR

**Mudança central em relação ao modelo aberto.** O cliente não se cadastra
sozinho a partir de um cartaz. O administrador (ou o balconista autorizado)
emite um convite.

1. No painel ou na PWA de balcão, o operador toca em **"Novo cliente"**
2. O sistema gera um **convite de uso único** e exibe o QR na tela
3. O cliente aponta a câmera do próprio celular para o QR
4. Abre o formulário de cadastro, já vinculado àquele convite
5. Cliente preenche: **nome, sobrenome, e-mail e data de nascimento**
6. Aceita os termos (LGPD)
7. Ao finalizar, **os botões de adicionar à carteira aparecem automaticamente**,
   sem passo intermediário
8. O convite é marcado como consumido e não funciona mais

#### Sobre o conteúdo do QR

> **Ponto que precisa de decisão do dono — ver Q8 no PRD.**
>
> O QR **não carrega** nome, e-mail ou data de nascimento do cliente: o operador
> não tem esses dados no momento da emissão. O que o QR carrega é um **token de
> convite** que abre o formulário onde o cliente digita esses campos.
>
> A alternativa — o operador digitar os dados do cliente e o QR conter tudo
> pronto — foi descartada porque transfere a digitação para o balcão, aumenta o
> tempo de fila e gera erro de digitação em e-mail.
>
> Se a intenção era essa segunda leitura, avisar antes da Fase 1: muda o
> formulário e a interface do balcão.

#### Regras do convite

- **Uso único.** Após o cadastro, o QR morre.
- **Expira em 15 minutos.** Convite gerado e não usado vira lixo.
- Exibido na tela do operador; opcionalmente impresso no cupom.
- Registra quem emitiu — auditoria de quem está cadastrando.

#### Chave de identidade

O **e-mail** é a chave natural do cliente, com unicidade por loja. Se o e-mail
já existir, não criar novo cadastro — direcionar para reemissão (F5).

> **Nota sobre telefone:** a versão anterior usava telefone como chave. Com o
> conjunto atual de campos, não há telefone. Consequência: campanhas futuras
> ficam limitadas a e-mail, e a recuperação de cartão também. No Brasil o
> WhatsApp costuma render muito mais que e-mail. **Recomendação:** incluir
> telefone como campo opcional no formulário. Decisão do dono — ver Q9 no PRD.

**Data de nascimento** só faz sentido coletar se for usada. Se não houver plano
de campanha de aniversário, é dado pessoal coletado sem finalidade — o que a
LGPD desaconselha. Ver Q10 no PRD.

### F2 — Carimbo

1. Cliente faz a compra e abre o passe na carteira
2. Balconista abre a PWA de scanner e aponta para o QR do passe
3. PWA lê o QR, que contém o `card_serial`
4. Backend valida, grava o selo, regenera a grade e atualiza o passe
5. PWA confirma exibindo **o nome do cliente** e o novo total
6. O passe no celular do cliente atualiza em segundos

**A confirmação precisa mostrar o nome.** É a defesa contra print de tela: o
balconista confere visualmente se é a pessoa na frente dele.

### F3 — Resgate

1. Cliente atinge 10 selos. O passe exibe "Cookie grátis disponível"
2. Balconista escaneia; a PWA detecta o cartão completo
3. Tela oferece a ação **Entregar cookie** — separada, nunca automática
4. Backend grava o resgate, incrementa o ciclo e zera os selos
5. Passe atualiza para 0/10 no novo ciclo

### F4 — Notificações

**a) Atualização do passe (automática)**
Toda mudança de selo notifica na tela de bloqueio, pelo mecanismo nativo da
carteira. Texto definido no construtor de cartão (ver `09-design-system.md`).

**b) Campanhas de marketing**
A carteira **não é canal de marketing**. O push só dispara quando um campo do
passe muda. Campanhas exigem e-mail (ou WhatsApp, se o telefone for coletado).

> Escopo: implementar apenas (a). Garantir que a base seja exportável em CSV.
> Não construir ferramenta de campanha agora.

### F5 — Reemissão de cartão (sem autoatendimento)

Cliente trocou de celular ou apagou o passe. **Como não há área do cliente, o
fluxo passa pela loja.**

1. Cliente informa o e-mail no balcão
2. Operador busca no painel ou na PWA
3. Toca em **"Reenviar cartão"**
4. Sistema envia link de reemissão por e-mail, válido por 30 minutos
5. Cliente abre o link e readiciona o passe

**Regra crítica:** o cartão reemitido mantém o **mesmo serial e os mesmos
selos**. Nunca gerar cartão novo para cliente existente. Perder saldo é o pior
bug possível neste produto.

Alternativa presencial: o operador exibe direto o QR de reemissão na tela, e o
cliente escaneia ali mesmo. Mais rápido e não depende de e-mail chegar.

### F6 — Gestão de funcionários

O administrador cadastra funcionários com login próprio. Todo selo, resgate e
convite registra **quem** executou. Base da auditoria interna.

### F7 — Painel do administrador

- Métricas: clientes, selos dados, cookies entregues, cartões perto do resgate
- Lista de clientes com saldo e última visita
- Emissão de convites de cadastro
- Reemissão de cartão
- Ajuste manual de selos, com justificativa obrigatória
- **Construtor de design do cartão** (ver `09-design-system.md`)
- **Exportação CSV** da base completa

> A base de clientes é o ativo mais valioso do programa. A exportação não é
> opcional.

---

## Regras de negócio

### RN1 — Idempotência do carimbo
Um cartão não recebe dois selos em menos de **3 minutos** na mesma loja. Segunda
tentativa retorna aviso informativo, não erro alarmante.

Duas camadas: header `Idempotency-Key` (contra clique duplo e retry de rede) e
janela temporal no banco (contra escaneamento repetido).

### RN2 — Limite por ciclo
Nunca passa de 10 selos. Tentativas adicionais informam que é preciso resgatar
primeiro.

### RN3 — Ciclos
Ao resgatar: selos voltam a 0, ciclo incrementa, histórico **nunca** é apagado.

### RN4 — Um cartão por cliente
Um cliente, um cartão ativo. Múltiplos cartões permitem fraude trivial.

### RN5 — Serial imutável
O `card_serial` é gerado uma vez e nunca muda. Está gravado no passe já
distribuído.

### RN6 — Convite de uso único
Um convite gera no máximo um cadastro. Expira em 15 minutos. Convite consumido
ou expirado retorna tela de erro amigável, com instrução de pedir outro ao
balcão.

### RN7 — Antifraude
Vetor principal: cliente tira print do QR e envia para amigos.

Defesas obrigatórias:
- Nome do cliente visível no verso do passe e na tela de confirmação
- Janela de idempotência (RN1)
- Registro de qual funcionário carimbou (F6)
- Cadastro por convite controlado (F1) — impede base inflada por cadastros falsos

Fora de escopo: QR rotativo/TOTP.

### RN8 — Publicação de design
Publicar um design novo atualiza o cartão de todos os clientes e dispara
notificação em todos os celulares. **Máximo de uma publicação por dia.**

---

## Fora de escopo (não construir)

- Área do cliente, login de cliente, app do cliente
- Cadastro aberto por cartaz sem convite
- Integração com PDV
- Múltiplas lojas (modelar no banco, não construir interface)
- Selos por valor gasto
- Níveis de fidelidade
- Campanhas automatizadas de e-mail ou WhatsApp
- Cupons de aniversário
- Indicação de amigos

## Requisitos não funcionais

| Requisito | Alvo |
|-----------|------|
| Emissão do convite (toque → QR na tela) | < 1s |
| Cadastro completo (scan → cartão na carteira) | < 90s |
| Carimbo (scan → confirmação) | < 2s |
| Atualização do passe no celular | < 30s |
| Disponibilidade no horário da loja | 99% |
| Volume ano 1 | < 5.000 clientes, < 200 selos/dia |
| Idioma | pt-BR |

Volume baixo. **Não otimizar prematuramente.**
