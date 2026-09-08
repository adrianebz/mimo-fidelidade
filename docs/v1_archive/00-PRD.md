# PRD — Cartão Fidelidade Digital
### Dessert Club

| | |
|---|---|

| **Data** | Setembro 2026 |
| **Status** | Aprovado para desenvolvimento |
| **Versão** | 1.1 — cadastro por convite, sem área de cliente, construtor de design, identidade tvOS |
| **Documentação técnica** | Pacote `spec-cartao-fidelidade/` |

---

## 1. Resumo executivo

Substituir a plataforma SaaS de fidelidade atual por um sistema próprio, com
cartão de selos distribuído via Apple Wallet e Google Wallet.

**Problema:** a plataforma atual cobra R$ 100 por pacote de clientes. O custo
cresce conforme a loja cresce — exatamente o inverso do desejável, já que
crescer é o objetivo.

**Solução:** sistema próprio com custo fixo anual de aproximadamente R$ 600,
independente do número de clientes.

**Recompensa:** 10 selos = 1 cookie grátis.

**Identidade visual:** linguagem Apple TV / tvOS — fundo quase preto, tipografia
grande, cartões com foco iluminado.

**Ponto de equilíbrio:** 6 pacotes de clientes. A partir daí, cada novo cliente
é gratuito.

---

## 2. Contexto e justificativa

### O que existe hoje

A loja opera um programa de fidelidade por selos em plataforma terceirizada. O
modelo funciona: clientes acumulam selos e resgatam brownies. O problema não é o
programa, é o modelo de cobrança.

### Por que agora

Três razões convergem:

1. **Custo escalando com o sucesso.** Quanto mais clientes o programa atrai,
   mais caro fica — o que desincentiva divulgá-lo.
2. **A base de clientes não é sua.** Os telefones e o histórico ficam na
   plataforma. Trocar de fornecedor no futuro significa recomeçar do zero.
3. **Sem controle sobre o produto.** Mudanças de layout, regras ou campanhas
   dependem do roadmap de terceiros.

### O que não muda

A mecânica permanece: 10 selos, 1 cookie grátis. Não é uma redefinição do
produto de fidelidade — é uma troca de infraestrutura, com dois acréscimos
deliberados: cadastro controlado por convite e autoria do design pelo dono.

---

## 3. Objetivos e métricas de sucesso

### Objetivos

| # | Objetivo | Prioridade |
|---|----------|-----------|
| O1 | Eliminar o custo variável por cliente | Crítico |
| O2 | Passar a ser dono da base de clientes | Crítico |
| O3 | Manter ou melhorar a experiência atual do cliente | Crítico |
| O4 | Manter a operação de balcão rápida | Alto |
| O5 | Viabilizar campanhas próprias no futuro | Médio |

### Métricas

**Métricas primárias** — definem se o projeto deu certo:

| Métrica | Baseline | Alvo (6 meses) |
|---------|----------|----------------|
| Custo mensal do programa | Variável, cresce | ≤ R$ 80 fixo |
| Clientes migrados da base antiga | — | ≥ 70% |
| Selos perdidos na migração | — | 0 |
| Tempo médio de carimbo no balcão | ~10s | ≤ 10s |

**Métricas secundárias** — indicam saúde do programa:

- Taxa de conclusão de cartão (clientes que chegam a 10 selos)
- Frequência média de visita de quem tem cartão
- Novos cadastros por semana
- Taxa de adição à carteira após o cadastro

**Contra-métrica** — o que não pode piorar:

- Reclamações no balcão sobre o cartão. Se subirem, o projeto falhou mesmo
  economizando dinheiro.

### O que explicitamente não é objetivo

- Aumentar vendas no curto prazo. O programa já existe; isto é troca de trilho.
- Ter mais recursos que a plataforma atual. Paridade basta.
- Construir um produto para vender a outras lojas. Pode virar isso depois, mas
  não orienta as decisões da v1.

---

## 3b. Três decisões que moldam o produto

### DP1 — A plataforma não tem versão de cliente

Sem login, app, portal ou consulta de saldo fora da carteira. O cliente vê o
formulário de cadastro **uma vez** e o passe na carteira **para sempre**.

**Ganhos:** superfície de ataque menor, menos código, menos suporte, e o passe
deixa de competir com um segundo lugar para ver o saldo.

**Custo:** todo cliente que trocar de celular vira atendimento manual no balcão.
Com poucos milhares de clientes é confortável. Se o programa passar de ~10 mil,
vale reabrir a decisão.

### DP2 — Cadastro só por convite QR do operador

Ninguém entra no programa sozinho. O operador emite um QR de uso único, válido
por 15 minutos, e o cliente escaneia ali no balcão.

**Ganhos:** base limpa (sem cadastro falso para farmar selo), rastro de quem
cadastrou, e o cadastro vira parte do atendimento.

**Custo:** impossível divulgar o programa com um cartaz. Toda entrada exige um
funcionário presente.

### DP3 — O administrador desenha o próprio cartão

Construtor com preview ao vivo das duas carteiras, validação de contraste e
publicação versionada.

**Limite honesto:** nem a Apple nem o Google permitem layout livre. O que é
editável são cores, logotipo, textos e o desenho da faixa de selos. Posição dos
campos, fonte e formato são fixos. A ferramenta precisa comunicar isso — prometer
liberdade total e entregar seis controles gera frustração.

---

## 4. Usuários

### Cliente da loja
Consumidor recorrente de cookies e brownies. Quer o benefício sem atrito.

**Necessidades:** não carregar cartão de papel, não instalar app, não lembrar de
nada, ver o saldo com facilidade.

**Frustrações a evitar:** cadastro longo, perder selos ao trocar de celular, ter
que abrir um app na fila.

### Balconista
Atende com fila, às vezes com as mãos ocupadas.

**Necessidades:** carimbar em poucos segundos, saber que deu certo, não errar.

**Frustrações a evitar:** tela lenta, login diário, dúvida sobre se o selo foi
registrado.

### Dono da loja
Quer o programa funcionando sem virar trabalho de TI.

**Necessidades:** ver quantos clientes tem, exportar a base, corrigir erros,
custo previsível.

---

## 5. Escopo

### Priorização MoSCoW

**Must have** — sem isso não lança:

- Emissão de convite QR pelo operador
- Cadastro com nome, sobrenome, e-mail e data de nascimento
- Botões de carteira aparecendo automaticamente ao finalizar o cadastro
- Cartão na Google Wallet, funcional e atualizando sozinho
- Cartão na Apple Wallet, funcional e atualizando sozinho
- Carimbo por leitura de QR pelo balconista
- Resgate ao completar 10 selos, com reinício do ciclo
- Proteção contra selo duplicado
- Reemissão de cartão pela loja, preservando os selos
- Exportação da base em CSV
- Consentimento LGPD
- Construtor de design do cartão com preview e validação
- Identidade visual tvOS em todas as superfícies

**Should have** — importante, mas não bloqueia:

- Painel com métricas básicas
- Ajuste manual de selos pelo administrador
- Gestão de funcionários com registro de quem carimbou e quem cadastrou
- Busca por e-mail como alternativa ao QR
- Rollback de versão de design

**Could have** — se sobrar tempo:

- Selo de boas-vindas no cadastro
- Histórico de visitas visível ao cliente
- Métricas por funcionário

**Won't have** — decidido que fica de fora:

| Item | Motivo |
|------|--------|
| Área do cliente / login de cliente | Decisão DP1. |
| Cadastro aberto por cartaz | Decisão DP2. |
| App nativo iOS/Android | A carteira já é o app. Duplicaria esforço. |
| Integração com PDV | Complexidade alta, ganho baixo no volume atual. |
| Selos por valor gasto | Regra atual é 1 por compra. Mudar confunde o cliente. |
| Níveis de fidelidade | Programa de 10 selos não comporta hierarquia. |
| Campanhas de WhatsApp | Fase futura. Coletar o telefone agora é suficiente. |
| Múltiplas lojas | Prever no banco, não construir interface. |
| Modo offline no balcão | Impossível validar duplicidade sem servidor. |
| QR rotativo antifraude | Custo alto para risco não comprovado. |

---

## 6. Requisitos funcionais

### RF1 — Cadastro por convite
O operador emite um QR de uso único. O cliente escaneia, informa nome,
sobrenome, e-mail e data de nascimento, aceita os termos, e **os botões de
adicionar à carteira aparecem automaticamente**.

**Aceite:** cadastro completo em menos de 90 segundos. O convite não funciona
uma segunda vez nem após 15 minutos.

### RF2 — Carimbo
O balconista escaneia o QR do cartão do cliente e confirma o selo.

**Aceite:** o balconista vê o nome do cliente antes de confirmar, e o passe no
celular do cliente atualiza em menos de 30 segundos.

### RF3 — Proteção contra duplicidade
O mesmo cartão não recebe dois selos em menos de 3 minutos.

**Aceite:** tentar carimbar duas vezes seguidas registra apenas um selo, com
aviso claro e não alarmante ao balconista.

### RF4 — Resgate
Ao completar 10 selos, o cartão sinaliza recompensa disponível. O balconista
confirma a entrega e o cartão reinicia.

**Aceite:** o resgate exige confirmação explícita, nunca é automático, e o
histórico permanece registrado.

### RF5 — Reemissão pela loja
O cliente que trocou de celular pede no balcão. O operador busca pelo e-mail e
reenvia o cartão, na tela ou por e-mail.

**Aceite:** o cartão reemitido mantém o mesmo serial e os mesmos selos. Nenhum
cliente perde saldo.

### RF8 — Construtor de design
O administrador altera cores, logotipo, estilo de selo e textos, com preview
das duas carteiras, e publica.

**Aceite:** publicar uma alteração e ver o cartão mudar em um iPhone e um
Android reais. Design com contraste insuficiente é bloqueado.

### RF6 — Notificação de progresso
O cliente é notificado na tela de bloqueio a cada selo recebido.

**Aceite:** a notificação aparece sem o cliente abrir nada.

### RF7 — Exportação da base
O dono baixa a lista completa de clientes em CSV a qualquer momento.

**Aceite:** o arquivo abre no Excel com acentuação correta.

---

## 7. Requisitos não funcionais

| Requisito | Alvo | Justificativa |
|-----------|------|---------------|
| Tempo de carimbo | < 2s | Fila no balcão |
| Atualização do passe | < 30s | Cliente ainda está na loja |
| Disponibilidade (horário comercial) | 99% | Fora do horário é irrelevante |
| Volume ano 1 | 5.000 clientes, 200 selos/dia | Base do dimensionamento |
| Custo de infraestrutura | ≤ R$ 950/ano | Razão de existir do projeto |
| Custo por cliente adicional | R$ 0 | Requisito central |
| Idioma | pt-BR | Público local |

---

## 8. Restrições

### Inegociáveis

1. **O cartão precisa aparecer na carteira nativa.** Atalho na tela de início
   ou app web foi avaliado e recusado — o valor do produto está em o cartão
   estar junto do cartão de crédito, não perdido entre ícones.

2. **Apple Developer Program é obrigatório.** US$ 99/ano. Não há alternativa
   técnica: a Apple exige assinatura criptográfica com certificado emitido por
   ela. Nenhum servidor, domínio ou configuração contorna isso.

3. **O custo não pode escalar com clientes.** Elimina qualquer fornecedor com
   cobrança por registro, por passe ou por notificação.

### Dependências externas

| Dependência | Prazo | Risco |
|-------------|-------|-------|
| Aprovação Apple Developer | 1–2 dias (PF) / até 3 semanas (CNPJ) | Bloqueia o cartão iOS |
| Aprovação do LoyaltyClass no Google | Alguns dias | Bloqueia produção Android |
| Exportação da base atual | Depende do fornecedor | Bloqueia a migração |

**As três precisam ser iniciadas na primeira semana.** São as únicas coisas que
não dependem de esforço próprio.

---

## 9. Riscos

| Risco | Prob. | Impacto | Mitigação |
|-------|-------|---------|-----------|
| Perder selos de clientes na migração | Média | **Crítico** | Exportar base antes de cancelar; rodar em paralelo; conferir saldo no balcão |
| Aprovação Apple atrasa | Média | Alto | Iniciar no dia 1; lançar Android primeiro |
| Certificado Apple expira sem aviso | Média | Alto | Lembrete no calendário 30 dias antes |
| Plataforma atual não exporta a base | Baixa | **Crítico** | Verificar **antes** de qualquer desenvolvimento |
| Cliente não consegue adicionar à carteira | Média | Médio | Piloto com 20 clientes antes de divulgar |
| Fraude por print do QR | Baixa | Baixo | Nome visível ao balconista; janela de 3 min |
| Admin publica design ilegível | Média | Médio | Validação de contraste bloqueante; rollback |
| Publicação em massa notifica todos repetidamente | Média | Médio | Limite de 1 publicação/dia |
| Cliente sem e-mail ativo não recebe reemissão | Média | Médio | Oferecer reemissão por QR na tela |
| Balconista resiste à ferramenta nova | Média | Médio | Envolver no piloto; interface de um toque |

### O risco que merece atenção especial

**Perder a base de clientes na transição.** É o único risco cujo dano é
irreversível. Dinheiro economizado não compensa clientes que perderam 8 selos e
foram embora.

Regra derivada: **não cancelar a plataforma atual até o piloto terminar com
sucesso.** Pagar dois meses a mais é seguro barato.

---

## 10. Cronograma

| Fase | Entrega | Duração |
|------|---------|---------|
| 0 | Fundação e contas | 2–3 dias + espera externa |
| 1 | Núcleo (clientes, selos, regras) | 5–7 dias |
| 2 | Google Wallet funcionando | 3–4 dias |
| 3 | Interface do balconista | 4–5 dias |
| 4 | Apple Wallet funcionando | 5–8 dias |
| 5 | Painel, reemissão, construtor de design | 7–9 dias |
| 6 | Piloto em loja | 5 dias corridos |

**Total: 6 a 8 semanas** de desenvolvimento em dedicação integral.

### Marcos

| Marco | O que significa |
|-------|-----------------|
| **M1** — Fim da Fase 2 | Sistema já usável na loja para clientes Android |
| **M2** — Fim da Fase 4 | Paridade com a plataforma atual |
| **M3** — Fim da Fase 6 | Autorizado a cancelar a assinatura antiga |

M1 é o marco que importa: a partir dele, o projeto deixa de ser aposta e vira
produto rodando.

---

## 11. Análise financeira

### Custo anual do sistema próprio

| Item | Valor |
|------|-------|
| Apple Developer Program | R$ 550 |
| Google Wallet | R$ 0 |
| Banco de dados | R$ 0 |
| Hospedagem | R$ 0–360 |
| Domínio | R$ 40 |
| **Total** | **R$ 590–950/ano** |

### Comparação

Plataforma atual: R$ 100 por pacote de clientes, crescente.
Sistema próprio: R$ 590–950/ano, fixo, clientes ilimitados.

**Ponto de equilíbrio: 6 pacotes.** Acima disso, o sistema próprio é mais
barato — e a diferença aumenta a cada cliente novo.

### O custo que não aparece na planilha

O desenvolvimento. Se for contratado, um freelance cobra entre R$ 8.000 e
R$ 20.000 por este escopo — equivalente a muitos anos da plataforma atual.

**A economia só se justifica em dois cenários:**

1. O desenvolvimento é feito internamente ou com agente de IA, sem custo de mão
   de obra relevante.
2. O sistema será replicado para outras lojas depois, transformando o custo de
   desenvolvimento em investimento de produto.

Se nenhum dos dois se aplicar, manter a plataforma atual é a decisão financeira
correta. Vale registrar isso explicitamente para que a decisão seja consciente.

### Ganho não financeiro

A propriedade da base de clientes. Uma lista de telefones de consumidores
recorrentes é o ativo mais valioso de um programa de fidelidade — mais que os
selos. Hoje ela pertence ao fornecedor.

---

## 12. Premissas

Se alguma destas se mostrar falsa, o plano precisa ser revisto:

- O programa de 10 selos permanece como está
- Volume anual abaixo de 5.000 clientes
- Uma única loja física na v1
- A loja tem internet estável no horário de funcionamento
- Existe um iPhone físico disponível para testes
- A plataforma atual permite exportar a base de clientes
- O desenvolvimento não terá custo de mão de obra significativo

---

## 13. Questões em aberto

Precisam de resposta antes ou durante a Fase 0:

| # | Questão | Impacto |
|---|---------|---------|
| Q1 | Conta Apple será PF ou CNPJ? | Muda o prazo de 2 dias para 3 semanas |
| Q2 | A plataforma atual exporta a base? Em qual formato? | Viabiliza ou inviabiliza a migração |
| Q3 | Quantos clientes existem hoje no programa? | Dimensiona o esforço de migração |
| Q4 | Quem serão os balconistas com acesso? | Define a Fase 5 |
| Q5 | Cliente que já tem selos migra com o saldo? | Recomendado sim — decisão do dono |
| Q6 | Haverá selo de boas-vindas no cadastro? | Afeta a taxa de adesão |
| Q7 | Já existe política de privacidade publicada? | Requisito LGPD para lançar |
| Q8 | O QR de convite deve conter os dados do cliente já preenchidos pelo operador, ou abrir o formulário para o cliente digitar? | Muda o formulário e o fluxo de balcão |
| Q9 | Coletar telefone além do e-mail? | Define o canal de campanha e de reemissão |
| Q10 | Haverá campanha de aniversário? | Se não, a data de nascimento é dado coletado sem finalidade (LGPD) |

**Q1, Q2 e Q8 são bloqueantes.**

Sobre **Q8**: a especificação assume que o QR carrega um **token de convite** e o
cliente digita os próprios dados. O operador não tem e-mail nem data de
nascimento no momento de emitir. A alternativa — operador digita tudo e o QR só
entrega — transfere a digitação para o balcão, aumenta a fila e erra e-mail.
Se a intenção era essa, avisar antes da Fase 1.

Sobre **Q9**: no Brasil, WhatsApp entrega muito melhor que e-mail. Sem telefone,
tanto a reemissão quanto qualquer campanha futura ficam limitadas. Recomendação:
campo opcional no formulário. A coluna já está no schema. As demais podem ser respondidas ao longo do
desenvolvimento.

---

## 14. Decisões registradas

Decisões já tomadas, com o motivo, para não serem reabertas sem informação nova:

| # | Decisão | Motivo |
|---|---------|--------|
| D1 | Carteira nativa, não PWA | O valor está em o cartão viver junto do cartão de crédito |
| D2 | Pagar o Apple Developer | Requisito técnico sem alternativa |
| D3 | Google Wallet antes da Apple | 90% do sistema é compartilhado; Google não tem espera nem custo |
| D4 | Sem modo offline no balcão | Impossível validar duplicidade sem servidor |
| D5 | Sem QR rotativo | Custo alto para risco não comprovado em loja de bairro |
| D6 | Histórico de selos nunca é apagado | Necessário para auditoria e resolução de disputas |
| D7 | Resgate manual, nunca automático | Cliente pode querer guardar; produto pode faltar |
| D8 | Marketing fora da carteira | A carteira só notifica quando o passe muda; não é canal de campanha |
| D9 | Sem versão de cliente da plataforma | Menos superfície, menos suporte; o passe basta (DP1) |
| D10 | Cadastro só por convite do operador | Base limpa e rastreável (DP2) |
| D11 | Design editável, layout não | Restrição das próprias carteiras, não escolha nossa |
| D12 | Uma publicação de design por dia | Cada publicação notifica todos os clientes |
| D13 | Identidade visual tvOS | Pedido do dono; combina com o cartão escuro do mockup |

---

## 15. Definição de pronto

O projeto está concluído quando:

- [ ] Operador emite convite e o cliente se cadastra em menos de 90 segundos
- [ ] Botões de carteira aparecem automaticamente ao fim do cadastro
- [ ] Cliente adiciona o cartão nas duas carteiras
- [ ] Balconista carimba em menos de 10 segundos
- [ ] O passe atualiza sozinho no celular do cliente
- [ ] Resgate funciona e reinicia o ciclo
- [ ] Base de clientes exportável em CSV
- [ ] Loja reemite cartão sem o cliente perder selos
- [ ] Administrador publica um design novo e vê o resultado nos dois celulares
- [ ] Política de privacidade publicada e consentimento coletado
- [ ] Piloto de uma semana concluído sem perda de selos
- [ ] Migração acima de 70% da base anterior
- [ ] Assinatura da plataforma antiga cancelada
