# Mimo — Fidelidade Digital
## Especificação de Projeto

Pacote de especificação da **Mimo**, plataforma SaaS multiempresa de fidelidade
por selos, com o cartão distribuído via **Apple Wallet** e **Google Wallet**.

**Comece pelo `00-PRD.md`.** Ele consolida escopo, decisões e pendências.

Clientes da plataforma: lojas físicas brasileiras. Consumidor final: cliente da
loja, sem app e sem login.
Programa: "Dessert Club" — **10 selos = 1 cookie grátis**.
Identidade visual: linguagem Apple TV / tvOS.

---

## Para o agente de desenvolvimento

Leia os documentos nesta ordem:

| # | Arquivo | Conteúdo |
|---|---------|----------|
| 0 | `00-PRD.md` | **Comece aqui.** Escopo, decisões, riscos, fases |
| 1 | `01-produto.md` | Requisitos funcionais e regras de negócio |
| 2 | `02-arquitetura.md` | Stack, componentes, decisões técnicas |
| 3 | `03-modelo-de-dados.md` | Modelo Firestore, unicidade, transações |
| — | `firestore.indexes.json` | Índices e políticas de TTL |
| — | `firestore.rules` | Regras de segurança |
| 4 | `04-api.md` | Contratos de todos os endpoints |
| 5 | `05-wallet-passes.md` | Geração dos passes Apple e Google |
| 6 | `06-frontend.md` | PWA de cadastro e PWA do balconista |
| 7 | `07-plano-de-entrega.md` | Fases, tarefas e critérios de aceite |
| 8 | `08-operacao.md` | Variáveis de ambiente, deploy, runbook |
| 9 | `09-design-system.md` | Design tokens tvOS e construtor de cartão |
| 10 | `10-marca-mimo.md` | Marca Mimo, arquitetura de duas marcas, pendências |
| 11 | `11-concorrencia.md` | Volta Aí e o mercado; posicionamento e paridade mínima |

## Restrições inegociáveis

Estas decisões já foram tomadas e **não devem ser revistas** pelo agente:

1. **O cartão precisa aparecer na Apple Wallet e na Google Wallet nativas.**
   PWA/atalho na tela de início não atende o requisito. Já foi avaliado e recusado.
2. **Não existe versão de cliente da plataforma.** Sem login, app ou portal do
   cliente. Ele vê o formulário de cadastro uma vez e o passe na carteira depois.
3. **Cadastro só por convite QR emitido pelo operador.** Sem cadastro aberto.
4. **A identidade visual combina estrutura tvOS com a marca Mimo.**
   Ver `09-design-system.md` e `10-marca-mimo.md`.
   **A marca do cartão na carteira é sempre a do lojista, nunca a Mimo.**
5. **Custo de infraestrutura deve ficar próximo de zero**, salvo a anuidade
   obrigatória do Apple Developer Program (US$ 99/ano). O motivo do projeto é
   substituir uma plataforma SaaS que cobra por pacote de clientes.
6. **O custo não pode escalar com o número de clientes.** Nenhuma dependência
   com cobrança por registro, por passe emitido ou por notificação enviada.
7. **O banco é o Cloud Firestore.** Não substituir por banco relacional.
   Consequência importante: ler `03-modelo-de-dados.md` antes de escrever
   qualquer código de escrita — Firestore não tem unicidade nem `CHECK`.
8. **Google Wallet primeiro, Apple depois.** Ver justificativa em
   `07-plano-de-entrega.md`. Não inverter a ordem.

## Ordem de execução recomendada

```
Fase 0  →  Fundação (banco, auth, deploy)
Fase 1  →  Núcleo compartilhado (clientes, cartões, selos, imagem)
Fase 2  →  Google Wallet (fim a fim, já usável na loja)
Fase 3  →  PWA do balconista (scanner)
Fase 4  →  Apple Wallet (certificado + web service + APNs)
Fase 5  →  Painel, reemissão e construtor de design
Fase 6  →  Piloto em loja
```

Fases 0–3 entregam um sistema **já operável em produção** para clientes Android.
A Fase 4 é a mais arriscada e depende de aprovação externa (Apple) — por isso vem
depois de o produto já estar validado.

## Glossário

- **Selo / carimbo** — unidade de progresso. 10 selos completam um ciclo.
- **Ciclo** — uma volta completa do cartão. Ao resgatar, o contador zera mas o
  histórico é preservado.
- **Passe** — o objeto na carteira do celular (`.pkpass` na Apple,
  `LoyaltyObject` no Google).
- **Convite** — QR de uso único, emitido pelo operador, que abre o cadastro.
- **Design** — versão publicada da aparência do cartão, criada no construtor.
- **Balconista** — funcionário da loja que escaneia o cartão e emite convites.
- **Administrador** — dono do programa; único com acesso ao construtor de design.
