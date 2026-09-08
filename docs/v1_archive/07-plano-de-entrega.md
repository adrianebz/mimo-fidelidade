# 07 — Plano de Entrega

## Princípio

**Google Wallet primeiro, Apple depois.** Não inverter.

Não é preferência de plataforma. Ao construir o Google, você constrói o banco, o
cadastro, a lógica de carimbo, a idempotência, o gerador de imagem e a PWA do
balconista — **cerca de 90% do sistema**, compartilhado entre as duas carteiras.

A Apple acrescenta apenas a camada de assinatura e o web service, plugados em
algo que já funciona e já foi validado com clientes reais.

Além disso, a Apple depende de aprovação externa com prazo imprevisível. Colocar
o caminho crítico atrás de uma dependência que você não controla é má
engenharia.

---

## Fase 0 — Fundação
**Antes de tudo**

- [ ] **Abrir conta no Apple Developer Program.** É o item de maior espera do
      projeto (1–2 dias para PF; até 3 semanas para CNPJ, que exige D-U-N-S).
      Fazer no dia 1 e deixar processando.
- [ ] Criar projeto no Google Cloud, ativar Wallet API, criar Issuer
- [ ] Submeter o `LoyaltyClass` para review do Google (também demora dias)
- [ ] Registrar domínio, configurar DNS
- [ ] Provisionar Postgres (Supabase), rodar `schema.sql`
- [ ] Esqueleto Fastify + TypeScript, healthcheck no ar
- [ ] CI simples: lint, typecheck, deploy automático
- [ ] Supabase Auth configurado, primeiro usuário `owner` criado

**Aceite:** `GET /health` responde 200 em produção, com HTTPS válido.

---

## Fase 1 — Núcleo compartilhado

- [ ] Módulo de clientes: criar, buscar por e-mail
- [ ] Módulo de convites: emitir, validar, consumir com trava transacional
- [ ] Módulo de cartões: criar com serial e auth_token
- [ ] Fluxo de cadastro por convite completo (`POST /api/enroll/:token`)
- [ ] Endpoint de carimbo com **transação, lock e idempotência** (RN1, RN2)
- [ ] Endpoint de resgate com ciclos (RN3)
- [ ] Gerador da grade de selos (SVG → PNG), com cache dos 11 estados
- [ ] Testes automatizados das regras de negócio

**Aceite:**
- Criar cliente, dar 10 selos, resgatar, verificar que o ciclo virou para 2 e os
  selos zeraram
- Dois `POST` de carimbo com a mesma `Idempotency-Key` → apenas 1 selo gravado
- Dois carimbos em 30 segundos → segundo retorna `409 STAMP_TOO_SOON`
- Carimbo em cartão com 10 selos → `409 CARD_FULL`
- Imagens de 0 a 10 selos geradas corretamente e visualmente conferidas
- Mesmo convite usado duas vezes em paralelo → apenas 1 cliente criado

> **Esta fase é a mais importante do projeto.** Se as regras de negócio
> estiverem certas aqui, o resto é encanamento. Não apressar.

---

## Fase 2 — Google Wallet

- [ ] Script de criação/atualização do `LoyaltyClass`
- [ ] Criação de `LoyaltyObject` no cadastro
- [ ] Geração do JWT e do link "Add to Google Wallet"
- [ ] `PATCH` do objeto a cada selo e a cada resgate
- [ ] Mensagem de notificação com `id` único (selo + ciclo)
- [ ] Página de cadastro `/entrar/:token` funcional, com botões de carteira
      aparecendo automaticamente ao finalizar

**Aceite:** em um Android real — cadastrar, adicionar o cartão à carteira,
carimbar pelo Postman e ver o cartão atualizar sozinho no celular, com
notificação.

**A partir daqui o sistema já é utilizável na loja para clientes Android.**

---

## Fase 3 — PWA do balconista

- [ ] Login de funcionário
- [ ] Scanner de QR com `@zxing/browser`
- [ ] Tela de confirmação com nome em destaque
- [ ] Ação de carimbo e ação de resgate
- [ ] Tratamento dos estados especiais (cartão cheio, selo recente, offline)
- [ ] Fluxo "Novo cliente": emitir QR, exibir em tela cheia, detectar conclusão
- [ ] Manifest PWA + instalação na tela de início
- [ ] Busca por e-mail como fallback
- [ ] Aplicar o design system tvOS (`09-design-system.md`)

**Aceite:** um funcionário que nunca viu o sistema consegue carimbar um cartão
em menos de 10 segundos, sem treinamento além de uma frase.

---

## Fase 4 — Apple Wallet
**A fase mais difícil. Reservar tempo com folga.**

Pré-condição: conta Apple aprovada.

- [ ] Criar Pass Type ID e gerar certificado (script OpenSSL em `05-wallet-passes.md`)
- [ ] Armazenar `.p12` como variável de ambiente
- [ ] Builder do `pass.json`
- [ ] Empacotamento e assinatura com `passkit-generator`
- [ ] `GET /api/passes/apple/:serial` servindo o `.pkpass`
- [ ] Os 4 endpoints do web service da Apple
- [ ] Cliente APNs (HTTP/2, mTLS, payload vazio)
- [ ] Disparo do push a cada mudança de cartão
- [ ] Endpoint `POST /v1/log` para capturar erros do device

**Aceite, em iPhone físico:**
1. Adicionar o passe pela página de cadastro
2. Confirmar que `apple_devices` recebeu o registro com push token
3. Carimbar pelo balcão
4. Ver o passe atualizar **sem tocar no celular**, com notificação na tela de
   bloqueio

**Ordem de depuração recomendada:** primeiro fazer o `.pkpass` estático abrir no
iPhone (isso valida certificado e assinatura, que é onde a maioria dos projetos
trava). Só depois partir para o web service e o push.

---

## Fase 5 — Painel, reemissão e construtor de design

- [ ] Fluxo F5 de reemissão pela loja (tela e e-mail)
- [ ] Painel: métricas, lista de clientes, ajuste manual
- [ ] Exportação CSV com BOM UTF-8
- [ ] Gestão de funcionários
- [ ] **Construtor de design**: controles, preview duplo, validação, publicação
      versionada, rollback
- [ ] Reemissão em lote dos passes após publicar design
- [ ] Página de política de privacidade (LGPD)
- [ ] Job de limpeza de `idempotency_keys` e `recovery_tokens`
- [ ] Job semanal de reconciliação de `stamps_count`

**Aceite:**
- Exportar a base em CSV e abrir no Excel com acentuação correta
- Alterar cor e estilo de selo no construtor, publicar, e ver o cartão mudar em
  um iPhone e um Android reais
- Tentar publicar com contraste insuficiente → bloqueado com mensagem clara

---

## Fase 6 — Piloto

- [ ] Rodar com 20 clientes reais na loja, com os dois sistemas
- [ ] Monitorar `pass_update_log` diariamente
- [ ] Coletar problemas de Android antigo, iPhone antigo, cliente que apagou
- [ ] Ajustar o que aparecer
- [ ] Só então divulgar amplamente

**Aceite:** uma semana sem incidente de perda de selos.

---

## Migração da plataforma atual

Ponto que costuma ser esquecido e causa dano real.

Os cartões que hoje estão na carteira dos clientes **pertencem à plataforma
atual**. Não existe transferência — cada cliente vai precisar adicionar o novo.

Plano obrigatório:

1. **Exportar a base atual antes de cancelar qualquer coisa.** Nome, telefone e
   saldo de selos. Se a plataforma não exportar, extrair manualmente.
2. Importar os clientes no novo sistema **com o saldo preservado**
   (`source = 'manual_adjust'`, nota "migração")
3. Rodar os dois em paralelo por 2–4 semanas
4. No balcão: quando o cliente apresentar o cartão antigo, oferecer o novo e
   confirmar que o saldo veio junto
5. Só cancelar a assinatura antiga quando a maioria tiver migrado

> **Não cancelar a plataforma atual antes da Fase 6 concluída.** Economizar
> R$ 100 e perder a base de clientes é um péssimo negócio.

---

## Estimativa

Desenvolvedor experiente, dedicação integral:

| Fase | Estimativa |
|------|-----------|
| 0 | 2–3 dias (+ espera externa) |
| 1 | 5–7 dias |
| 2 | 3–4 dias |
| 3 | 4–5 dias |
| 4 | 5–8 dias ← alta variância |
| 5 | 7–9 dias |
| 6 | 5 dias corridos |

**Total: 6 a 8 semanas**, mais a espera de aprovação da Apple e do Google, que
correm em paralelo se a Fase 0 for feita no dia 1.

A Fase 5 cresceu com o construtor de design — é uma ferramenta de autoria
completa, com preview e versionamento, não um seletor de cores.

A Fase 4 tem a maior variância do projeto. Se o certificado der problema, pode
consumir dias sozinha. É o principal motivo de ela vir depois de o sistema já
estar rodando.
