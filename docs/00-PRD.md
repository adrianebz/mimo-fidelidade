# PRD — Mimo
## Plataforma multiempresa de fidelidade em carteira digital

| | |
|---|---|
| **Produto** | Mimo — Fidelidade Digital |
| **Versão do documento** | 2.0 |
| **Data** | Setembro 2026 |
| **Status** | Base para desenvolvimento |
| **Modelo** | SaaS B2B multiempresa |
| **Mercado inicial** | Lojas físicas brasileiras |
| **Idioma da v1** | pt-BR |
| **Documentação técnica** | Pacote `spec-cartao-fidelidade/`, documentos 01 a 10 |

---

## 1. Resumo executivo

Mimo é uma plataforma SaaS que permite a qualquer lojista operar um programa de
fidelidade por selos, com o cartão vivendo dentro da Apple Wallet e da Google
Wallet do consumidor.

O consumidor não instala aplicativo, não cria senha e não acessa portal. Ele se
cadastra uma vez, por convite QR emitido no balcão, e acompanha o saldo no
cartão da carteira que já usa todo dia.

Mecânica inicial: **10 selos = 1 recompensa**, com o texto da recompensa
definido por cada lojista.

A plataforma é responsável por isolamento entre lojistas, gestão de organizações
e equipes, emissão e atualização dos passes, auditoria e suporte.

### Mudança de natureza do projeto

Este documento substitui uma versão anterior que descrevia um sistema interno
para uma única loja, cuja justificativa era economizar R$ 100 por pacote de
clientes.

**Isso não é mais o projeto.** Mimo é um produto para vender a terceiros. A
justificativa deixa de ser economia de custo e passa a ser receita. As
consequências são reais e estão registradas ao longo do documento: isolamento de
dados vira requisito legal, o certificado da Apple vira risco concentrado, e
suporte vira trabalho recorrente que antes não existia.

---

## 2. Problema e oportunidade

Lojas físicas de bairro operam fidelidade com cartão de papel — que se perde, se
falsifica e não gera dado nenhum — ou com plataformas que cobram por pacote de
clientes, penalizando exatamente o crescimento que o programa deveria produzir.

Mimo oferece:

- cartão na carteira que o consumidor já abre para pagar
- operação de balcão em poucos segundos, por leitura de QR
- base de clientes e histórico pertencentes ao lojista, exportáveis a qualquer
  momento
- custo por lojista previsível, sem cobrança por passe emitido
- uma única infraestrutura atendendo muitos lojistas, com isolamento de dados

---

## 3. Objetivos e métricas

### Objetivos do MVP

| # | Objetivo | Prioridade |
|---|---|---|
| O1 | Isolar completamente os dados entre lojistas | Crítico |
| O2 | Permitir onboarding de um lojista sem intervenção de engenharia | Crítico |
| O3 | Entregar cartões funcionais nas duas carteiras | Crítico |
| O4 | Registrar selos e resgates com consistência transacional | Crítico |
| O5 | Manter a operação de balcão rápida sob fila | Alto |
| O6 | Dar ao lojista autonomia sobre a identidade do próprio cartão | Alto |
| O7 | Validar disposição a pagar com lojistas reais | Alto |

### Métricas

**Primárias — definem se o MVP deu certo:**

| Métrica | Meta |
|---|---|
| Acesso cruzado entre organizações | **zero**, em teste e em produção |
| Incidente de saldo perdido ou divergente | **zero** no piloto |
| Confirmação do carimbo no balcão | ≤ 2s (backend, sem contar a carteira) |
| Cadastro do consumidor completo | ≤ 90s |
| Piloto | 2–3 lojistas, 20–50 clientes cada |
| Lojistas dispostos a pagar após o piloto | ≥ 2 de 3 |

**Secundárias — saúde do produto:**

- Taxa de adição à carteira após o cadastro
- Taxa de conclusão de cartão (clientes que chegam a 10 selos)
- Tarefas de sincronização na fila com falha persistente
- Tempo de onboarding de um novo lojista

**Contra-métricas — o que não pode piorar:**

- Reclamações no balcão sobre lentidão. Um sistema seguro e lento perde para
  o cartão de papel.
- Custo de suporte por lojista. Se cada lojista consumir horas por semana, o
  modelo não escala.

---

## 4. Escopo

### Must have

- Cadastro, ativação e suspensão de organizações pelo admin da plataforma
- Gestão de lojas, equipe e permissões pelo lojista
- Convite QR de uso único emitido no balcão
- Cadastro do consumidor com dados mínimos e consentimento versionado
- Cartão funcional no Google Wallet e no Apple Wallet
- Carimbo com idempotência e janela antiduplicação
- Resgate explícito com abertura de novo ciclo
- Fila assíncrona de atualização de passe, com retry
- Reemissão de cartão preservando serial, saldo e ciclo
- Isolamento de dados por organização, verificado por teste automatizado
- Exportação CSV limitada à própria organização
- Auditoria de convite, selo, resgate, ajuste, reemissão e exportação
- Construtor de identidade do cartão, com preview e validação de contraste

### Should have

- Painel de saúde das integrações para o admin da plataforma
- Ajuste manual de selos com justificativa obrigatória
- Métricas do lojista via contadores incrementais
- Rollback de versão de design
- Busca de cliente por e-mail como alternativa ao QR

### Could have

- Selo de boas-vindas configurável
- Métricas por funcionário
- Reemissão por e-mail além do QR na tela

### Won't have no MVP

| Item | Motivo |
|---|---|
| App nativo ou login do consumidor | O passe na carteira já é a interface |
| Cadastro público sem convite | Base limpa e rastreável exige convite |
| Integração com PDV | Complexidade alta, ganho baixo no volume inicial |
| Cobrança automática de assinatura | 2–3 lojistas se faturam à mão |
| Campanhas de e-mail ou WhatsApp | Fase futura; coletar o contato agora basta |
| QR dinâmico antifraude | Custo alto para risco não comprovado |
| Layout livre dentro das carteiras | Impossível — restrição da Apple e do Google |
| Marketplace ou base compartilhada entre lojistas | Contraria o isolamento, que é o requisito central |
| Selos por valor gasto, níveis de fidelidade | Fora da mecânica de 10 selos |

---

## 5. Perfis e permissões

| Perfil | Escopo | Permissões |
|---|---|---|
| **Admin da plataforma** | todas as organizações | onboarding, suspensão, suporte, auditoria de plataforma |
| **Owner do lojista** | uma organização | lojas, equipe, configurações, design, exportações, relatórios |
| **Manager** | lojas atribuídas | operação, clientes, reemissão, equipe conforme delegação |
| **Clerk / balconista** | lojas atribuídas | convite, leitura, selo, resgate |
| **Consumidor** | seu cartão | cadastro único e o passe na carteira |

### Regra de autorização

O backend valida o token Firebase do funcionário **e** o documento de associação
dele à organização. O `organizationId` presente na URL **não é prova de
autorização** — é apenas um parâmetro. Um balconista precisa, adicionalmente,
ter a loja em `store_ids`.

Toda rota autenticada resolve o perfil pelo documento de associação, nunca pelo
que vem do cliente.

---

## 6. Modelo multiempresa e isolamento

Cada lojista é uma `organization`. Cada unidade física é uma `store`. Nenhuma
coleção ou consulta operacional permite que um lojista alcance dados de outro.

```text
organizations/{organizationId}
  stores/{storeId}
  members/{firebaseUid}
  customers/{customerId}
  uniques/{tipo_valor}
  cards/{serial}
    stamps/{stampId}
    redemptions/{redemptionId}
    devices/{deviceLibraryId}
  designs/{version}
  counters/{counterId}
  idempotency/{hash}
  pass_outbox/{jobId}
  audit/{eventId}
```

### Regras essenciais

- Cartões, clientes, histórico, configuração visual, exportações e logs são
  sempre vinculados a uma organização
- Cada cartão pertence a uma única organização e a uma única loja de origem
- A fila de atualização carrega `organization_id` e só toca o passe correspondente
- A URL do web service Apple inclui a organização
- IDs do Google Wallet incorporam a organização, evitando colisão
- As regras do Firestore negam todo acesso direto de cliente; só o Admin SDK escreve

### Três armadilhas do Firestore que o isolamento por caminho não resolve

**a) Collection group query atravessa organizações.**
`stamps` é subcoleção de `cards`. Métricas do tipo "selos no mês" exigem
collection group query — e ela varre **todas** as organizações por padrão. Se o
filtro por organização for esquecido, o painel de um lojista soma os selos de
outro.

Obrigatório: gravar `organization_id` em **todo** documento de selo, resgate e
device, mesmo sendo redundante com o caminho. E um teste automatizado que roda
uma collection group query sem filtro e falha se retornar dados de duas
organizações.

**b) Não existe constraint de unicidade.**
E-mail precisa ser único **por organização** — a mesma pessoa pode ser cliente
de duas lojas diferentes. A solução é um documento em
`organizations/{org}/uniques/email_{email}` criado com `create()` dentro da
transação. Verificar antes e gravar depois, fora de transação, não protege.

**c) `COUNT` não escala.**
Painel que varre coleção a cada carregamento queima a cota, e o problema cresce
linearmente com o número de lojistas. Contadores incrementais atualizados na
mesma transação do carimbo.

Detalhamento em `03-modelo-de-dados.md`.

---

## 7. Arquitetura de marca

Mimo é a marca da plataforma. O lojista tem a própria marca. **Elas não competem
pelo mesmo espaço.**

| Superfície | Marca dominante |
|---|---|
| Site institucional e material de venda | Mimo |
| Painel da plataforma | Mimo |
| Painel do lojista | Mimo na moldura, lojista no conteúdo |
| PWA de balcão | Lojista |
| Formulário de cadastro do consumidor | Lojista, com assinatura Mimo discreta |
| **Cartão na carteira** | **Lojista, sempre** |
| Notificação da carteira | Lojista |

O material de identidade mostra o cartão da carteira com a marca Mimo. Isso
funciona para vender ao lojista, **não para o produto**: o cliente da padaria
adiciona o cartão da padaria. Ver ver a marca errada na carteira destrói
justamente o reforço de marca que o lojista está comprando.

Tecnicamente viável: o `organizationName` do passe Apple é por passe, e o
`issuerName` do Google fica na `LoyaltyClass`, que já é uma por organização.

Detalhamento, paleta, tipografia e pendências em `10-marca-mimo.md`.

---

## 8. Fluxos

### 8.1 Onboarding do lojista
1. Admin da plataforma cria a organização (nome jurídico, nome público, plano)
2. Owner cria a primeira loja
3. Owner adiciona managers e balconistas, atribuindo as lojas permitidas
4. Owner configura marca, recompensa, termos e design do cartão
5. A plataforma cria a `LoyaltyClass` da organização no Google
6. Teste interno com um cartão antes de liberar a organização

### 8.2 Cadastro do consumidor
1. Balconista escolhe **Novo cliente**
2. Plataforma gera convite QR de uso único, expiração de 15 minutos
3. Consumidor escaneia com o próprio celular, confere a loja, preenche
4. Aceita a política de privacidade daquela organização, com versão registrada
5. Sistema cria cliente e cartão; **os botões de carteira aparecem automaticamente**
6. O convite é consumido e não funciona mais

### 8.3 Carimbo
1. Consumidor apresenta o QR do passe
2. Balconista escaneia e vê **nome, saldo e estado**
3. Balconista confirma
4. Transação grava o selo, incrementa saldo e contadores, e enfileira a
   atualização do passe
5. PWA confirma o novo saldo — vindo do banco, não da carteira
6. Worker sincroniza Google e Apple de forma assíncrona

### 8.4 Resgate
1. O décimo selo muda o cartão para recompensa disponível
2. Essa transição é a **única** que dispara notificação na carteira
3. Balconista escaneia e confirma a entrega
4. Sistema grava o resgate, incrementa o ciclo, zera o contador
5. Histórico permanece íntegro para auditoria

### 8.5 Reemissão
1. Consumidor pede no balcão
2. Funcionário localiza o cartão **dentro da própria organização**
3. Plataforma gera link ou QR de uso único e curta duração
4. O mesmo cartão vai para o novo aparelho, preservando serial, saldo e ciclo

---

## 9. Regras de negócio

| # | Regra |
|---|---|
| RN1 | Máximo de 10 selos por ciclo no MVP |
| RN2 | Resgate é sempre explícito, nunca automático |
| RN3 | Todo carimbo exige `Idempotency-Key`, com escopo de cartão e endpoint |
| RN4 | Mesmo cartão não recebe dois selos em menos de 3 minutos |
| RN5 | A transação de selo **não depende** de Apple, Google ou push |
| RN6 | A confirmação no balcão vem do banco transacional, não da carteira |
| RN7 | Só a transição para recompensa disponível dispara notificação |
| RN8 | Atualizações comuns de saldo usam atualização silenciosa |
| RN9 | Um convite gera no máximo um cadastro; expira em 15 minutos |
| RN10 | `serial` do cartão é imutável |
| RN11 | Histórico de selos e resgates nunca é apagado |
| RN12 | Falha de sincronização **nunca** desfaz uma transação de fidelidade |
| RN13 | Publicação de design é limitada a uma por dia por organização |
| RN14 | E-mail é único por organização, não globalmente |

**RN7 merece destaque.** Notificar a cada selo produz dez notificações por
ciclo. O consumidor desativa e perde também a notificação que importa. Notificar
só na liberação da recompensa preserva o sinal.

---

## 10. Carteiras digitais

### Google Wallet
- `LoyaltyClass` por organização, `LoyaltyObject` por cartão
- Criar e atualizar **no worker**, nunca dentro do request de carimbo
- Service account exclusiva do backend, autorizada como Developer no console
- Contas novas começam em demonstração: perfil empresarial, primeira classe e
  pedido de publicação são pré-requisitos de produção

### Apple Wallet
- Pass Type ID e certificados no cofre de segredos da plataforma
- `.pkpass` assinado por cartão
- `webServiceURL` com caminho de organização, `authenticationToken` por cartão
- Registro de device, push APNs vazio na mudança, entrega da versão corrente
- `pass_revision` monotônica, **não timestamp** — relógios e concorrência tornam
  timestamp pouco confiável para decidir o que mudou
- Validação obrigatória em iPhone físico

### Estrutura, cores e textos configuráveis
Ver `05-wallet-passes.md`, Parte D, para o mapeamento completo entre a config do
construtor e os campos de cada carteira. Posição de campo, tipografia, formato
do cartão e aparência da notificação **não são configuráveis** — restrição das
próprias carteiras.

---

## 11. Arquitetura técnica

| Camada | Tecnologia |
|---|---|
| Backend | Node.js, TypeScript, Fastify |
| Banco | Cloud Firestore, via Firebase Admin SDK |
| Auth de equipe | Firebase Authentication |
| Google Wallet | REST API + service account |
| Apple Wallet | PassKit + certificado + APNs |
| Assíncrono | `pass_outbox` no Firestore, worker com retry e backoff |
| Frontend | PWA React: balcão, painel do lojista, painel da plataforma |
| Imagens | SVG convertido em PNG, com fonte embutida |
| Deploy | Cloud Run, `southamerica-east1`, `min-instances: 1` |

Detalhamento em `02-arquitetura.md`.

---

## 12. Requisitos não funcionais

| Requisito | Meta |
|---|---|
| Isolamento entre lojistas | obrigatório por código, estrutura e teste automatizado |
| Carimbo | ≤ 2s para confirmação no backend |
| Sincronização com a carteira | eventual, com retry e telemetria; sem prazo fixo prometido |
| Disponibilidade em horário comercial | 99% após o MVP |
| Auditoria | eventos críticos rastreáveis por organização, loja e usuário |
| Escalabilidade | sem cobrança por passe pelas carteiras; monitorar custo Firestore |
| Acessibilidade | contraste 4.5:1, foco visível, teclado, nada indicado só por cor |

---

## 13. Privacidade e LGPD

### Papéis — decisão necessária antes do primeiro cliente real

O lojista é **controlador** dos dados dos seus clientes. Mimo é **operadora**.
Isso exige contrato de tratamento de dados assinado com cada lojista antes do
primeiro consumidor cadastrado. Não é item de Fase 5.

### Requisitos
- Coletar apenas o mínimo necessário ao fluxo escolhido
- **Não tornar data de nascimento obrigatória sem finalidade concreta e
  informada.** Se não houver campanha de aniversário planejada, é dado coletado
  sem propósito
- Registrar versão da política, data de aceite, finalidade e retenção
- Nunca expor telefone ou e-mail completo no passe ou na tela do balcão
- Exportação, correção, exclusão/anonimização e canal para direitos do titular
- Ao excluir um cliente, apagar também o documento em `uniques/` — senão o
  e-mail fica bloqueado para sempre

---

## 14. Riscos

### Riscos concentrados de plataforma

Estes existem porque Mimo é multiempresa. Não existiam no projeto de loja única.

| Risco | Impacto | Mitigação |
|---|---|---|
| **Acesso cruzado entre lojistas** | Crítico — incidente de dados, quebra contratual | Isolamento por caminho + validação de associação + teste de collection group |
| **Certificado Apple único derruba todos** | Crítico | Renovação tratada como incidente de plataforma, alerta 60 dias antes, runbook ensaiado |
| **Issuer Google suspenso por conduta de um lojista** | Crítico | Cláusula de conteúdo no contrato; revisão do design antes de publicar a classe |
| Perda de saldo na migração de um lojista | Alto | Importar com `source: migration`, rodar em paralelo, desligar o antigo só após o piloto |
| Cota do Firestore estourada por consulta mal feita | Médio | Contadores incrementais, alerta de orçamento, revisão em code review |
| Falha persistente da API da carteira | Médio | Outbox com retry; **nunca reverter selo por falha de sincronização** (RN12) |
| QR fotografado e compartilhado | Baixo | Nome exibido para conferência humana, janela de 3 min, auditoria |
| Custo de suporte por lojista inviabiliza o modelo | Médio | Medir horas de suporte por lojista no piloto |
| **Chegar ao mercado sem diferencial funcional** | Alto | Paridade mínima antes de vender: geofencing, código digitado, cadastro configurável (`11-concorrencia.md`) |
| Concorrente estabelecido com preço menor | Alto | Posicionar por preço fixo com cartões ilimitados |

### Sobre o certificado único da Apple

Todos os cartões de todos os lojistas são assinados sob o mesmo Pass Type ID da
Mimo. É o modelo padrão do mercado e o único viável comercialmente — exigir que
cada lojista abra conta na Apple transforma um onboarding de minutos em uma
espera de semanas e mata a conversão.

Mas concentra risco: certificado revogado ou expirado derruba **todos** os
lojistas simultaneamente, e a Apple responsabiliza o dono do Pass Type ID pelo
conteúdo de todos os passes.

Decisão consciente, registrada em D8.

---

## 15. Modelo de negócio

### Custo de infraestrutura

| Item | Custo anual |
|---|---|
| Apple Developer Program (um, compartilhado) | R$ 550 |
| Google Wallet Issuer | R$ 0 |
| Domínio + HTTPS | R$ 40 |
| Cloud Run (`min-instances: 1`) | R$ 150–300 |
| Firestore (cota gratuita cobre os primeiros lojistas) | R$ 0 |
| Backup e armazenamento | R$ 10 |
| **Base fixa** | **~R$ 750–900/ano** |

### Custo marginal por lojista

Praticamente zero até o limite da cota gratuita do Firestore. Um lojista com 200
selos/dia consome cerca de 1.000 escritas diárias; a cota gratuita é de 20.000.
**Cabem cerca de 15 a 20 lojistas ativos antes de a cobrança começar** — e ainda
assim em centavos por operação.

### Onde o custo real está

Não é infraestrutura. É **suporte e desenvolvimento**. Cada lojista traz
dúvidas, pedidos de ajuste e incidentes. Medir isso no piloto é o objetivo O7:
se cada lojista consumir horas por semana, o preço precisa refletir, ou o
produto precisa de mais autonomia.

### Precificação

Fora de escopo do MVP (faturamento manual com 2–3 lojistas), mas o mercado já
estabeleceu a âncora. O concorrente direto **Volta Aí** cobra R$ 24 (200
cartões), R$ 49 (500) e R$ 79 (1.500) por mês — sempre **por volume de cartões**.
Ver `11-concorrencia.md`.

Isso importa por dois motivos:

1. A base de infraestrutura da Mimo (~R$ 70/mês) equivale a **três assinaturas
   Starter do concorrente**. Só a partir de ~10 lojistas pagantes o modelo
   respira.
2. **A cunha competitiva é preço fixo com cartões ilimitados.** O custo marginal
   por cartão da Mimo é próximo de zero; o modelo de cobrança dos concorrentes
   não permite acompanhar. É a mesma dor que originou este projeto.

**Decisão até o fim do piloto (Q15), com modelagem de cota real (Q18).**

---

## 16. Fases de entrega

| Fase | Entrega | Critério de aceite |
|---|---|---|
| **0** | Contas, domínio, Firebase, credenciais | Ambientes e segredos configurados; nenhuma chave no repositório; regras do Firestore negam acesso externo |
| **1** | Plataforma multiempresa | **Duas organizações isoladas em teste automatizado**, incluindo collection group query sem filtro |
| **2** | Núcleo de fidelidade | Convite, cartão, selo, resgate e idempotência funcionando; testes de concorrência passando |
| **3** | PWA de balcão + Google Wallet | Android real adiciona e atualiza o cartão |
| **4** | Apple Wallet | iPhone físico instala e atualiza o passe |
| **5** | Painéis, design e operação | Lojista opera equipe, clientes, design e exportação sozinho |
| **6** | Piloto | 2–3 lojistas sem perda de saldo e sem acesso cruzado |

### Testes de aceite obrigatórios da Fase 1 e 2

Estes três protegem contra os bugs mais prováveis do Firestore:

1. Dois cadastros simultâneos com o mesmo e-mail na mesma organização → **1
   cliente criado**
2. Dois carimbos simultâneos com a mesma `Idempotency-Key` → **1 selo gravado**
3. Collection group query sem filtro de organização → **falha o teste**

### Dependências com prazo externo — iniciar na Fase 0

| Dependência | Prazo típico |
|---|---|
| Apple Developer Program (CNPJ exige D-U-N-S) | até 3 semanas |
| Aprovação de publicação do Google Wallet Issuer | dias a semanas |
| Contrato de tratamento de dados revisado | depende do jurídico |

São as únicas coisas que não dependem de esforço próprio. Atrasar aqui atrasa
tudo.

---

## 17. Decisões registradas

| # | Decisão | Motivo |
|---|---|---|
| D1 | Multiempresa desde o início | Retrofit de isolamento em base single-tenant é reescrita |
| D2 | Cloud Firestore como banco | Mesma conta do Google Wallet; cota grátis; zero manutenção |
| D3 | Google Wallet primeiro, Apple em paralelo à aprovação | 90% do sistema é compartilhado; Google não tem espera nem custo |
| D4 | Consumidor sem login, app ou portal | Menos superfície, menos suporte; o passe basta |
| D5 | Cadastro só por convite QR de uso único | Base limpa e rastreável |
| D6 | Notificação só na liberação da recompensa | Dez notificações por ciclo destroem o canal |
| D7 | QR estático com conferência humana | Dinâmico tem custo alto para risco não comprovado |
| D8 | Pass Type ID único da plataforma | Único modelo viável comercialmente; risco aceito e mitigado |
| D9 | Atualização de passe assíncrona via outbox | Falha externa não pode desfazer fidelidade (RN12) |
| D10 | `pass_revision` monotônica, não timestamp | Relógio e concorrência tornam timestamp inconfiável |
| D11 | Lojistas nunca acessam dados de outros lojistas | Requisito legal e contratual, não preferência |
| D12 | Marca do cartão é do lojista, nunca da Mimo | O ativo de marca reforçado precisa ser o do lojista |
| D13 | Estrutura visual tvOS, voz da marca Mimo | Fundo escuro e hierarquia ampla com Montserrat e amarelo Mimo |
| D14 | Design editável, layout não | Restrição da Apple e do Google, não escolha nossa |
| D15 | Cloud Run com `min-instances: 1` | Cold start estoura o alvo de 2s no carimbo |

---

## 18. Questões em aberto

| # | Questão | Bloqueia | Prazo |
|---|---|---|---|
| Q1 | Conta Apple em nome de PF ou CNPJ? | Prazo de aprovação (2 dias vs 3 semanas) | **Fase 0** |
| Q8 | O QR de convite abre formulário para o cliente digitar, ou o operador digita antes? | Formulário e fluxo de balcão | **Fase 0** |
| Q9 | Coletar telefone além do e-mail? | Canal de reemissão e campanha futura | **Fase 1** |
| Q10 | Data de nascimento tem finalidade concreta? | LGPD — sem finalidade, não coletar | **Fase 1** |
| Q12 | Qual paleta Mimo é a canônica? Os dois materiais divergem em 4 de 5 cores | Todo o CSS e a geração de imagens | **Fase 1** |
| Q13 | Qual arquivo de Montserrat Rounded, e sob qual licença? | Gerador de imagem em produto comercial | **Fase 1** |
| Q11 | Lojista pode remover a assinatura Mimo? (white-label) | Modelo de dados da config de design | Fase 5 |
| Q14 | Selo padrão: círculo neutro ou símbolo Mimo? | Gerador de imagem e construtor | Fase 5 |
| Q15 | Modelo de precificação | Faturamento pós-piloto | Fase 6 |
| Q17 | Cadastro configurável entre convite e QR aberto? | Remove o principal atrito competitivo | Fase 2 |
| Q18 | Preço fixo com cartões ilimitados é sustentável? | Modelagem de cota Firestore | Fase 6 |
| Q19 | Qual o time-to-value medido da Mimo? | Concorrente promete 5 minutos | Fase 5 |
| Q20 | Por que o lojista trocaria de plataforma? | **Valida o posicionamento** | Fase 6 |
| Q16 | Contrato de tratamento de dados: quem redige e revisa? | Primeiro cliente real | **Fase 0** |

**Q1, Q8, Q12, Q13 e Q16 são bloqueantes.**

Sobre **Q12**: os dois materiais de identidade trazem paletas diferentes — só o
verde `#16A34A` bate. Cor de marca acaba em CSS, em imagem gerada e no
`backgroundColor` do passe; corrigir depois republica todos os cartões de todos
os lojistas.

Sobre **Q13**: "Montserrat Rounded" não é família oficial do Google Fonts. Como
será embutida no servidor de um produto comercial vendido a terceiros, confirmar
arquivo e licença antes da Fase 1.

---

## 19. Definição de pronto

O MVP está concluído quando:

- [ ] Admin da plataforma cria uma organização e um owner sem apoio de engenharia
- [ ] Owner configura loja, equipe, design e recompensa sozinho
- [ ] Balconista emite convite e o consumidor se cadastra em ≤ 90s
- [ ] Botões de carteira aparecem automaticamente ao fim do cadastro
- [ ] Cartão funciona e atualiza em Android e iPhone físicos
- [ ] Carimbo confirma em ≤ 2s mesmo com a carteira offline
- [ ] Resgate abre novo ciclo preservando o histórico
- [ ] Reemissão preserva serial, saldo e ciclo
- [ ] Testes de isolamento, concorrência e idempotência passando em CI
- [ ] Auditoria registra convite, selo, resgate, ajuste, reemissão e exportação
- [ ] Exportação CSV limitada à própria organização
- [ ] Contrato de tratamento de dados assinado com cada lojista do piloto
- [ ] Piloto de 2–3 lojistas concluído sem perda de saldo e sem acesso cruzado
