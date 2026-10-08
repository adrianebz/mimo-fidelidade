# 13 — Domínio próprio e publicação (passo a passo)

Runbook para colocar o Boomii no ar em `www.boomii.com.br`. Escrito para quem
tem acesso ao Console do Firebase e ao painel do registro.br.

**O projeto do Firebase continua sendo `mimo-2d6eb`.** Não há criação de
projeto, troca de credenciais nem migração de dados: Firestore, Storage,
Functions e service account permanecem como estão. A marca nova entra pelo
domínio e por um site de Hosting novo dentro do mesmo projeto.

**Há um único domínio próprio.** A área do lojista usa o `.web.app` que o
Firebase fornece de graça — sem DNS e sem certificado a configurar para ela.

> **Por que o ID do projeto não muda:** o ID de um projeto Firebase é imutável.
> Trocá-lo significaria criar um projeto do zero e migrar tudo. Como
> consequência, `mimo-2d6eb` continua aparecendo no bucket de Storage e nas URLs
> das Cloud Functions — endereços de infraestrutura, visíveis a quem inspecionar
> o tráfego da página. O `authDomain` **sai** da lista: é trocável por domínio
> próprio na fase 6. Se a restrição legal alcançar também Storage e Functions, a
> migração de projeto descrita em `12-migracao-marca.md` volta a ser necessária.

---

## Visão geral

Um único deploy e um único endereço oficial: **`www.boomii.com.br`**.

| Caminho | Papel |
|---|---|
| `/` , `/como-funciona` , `/precos` , `/contato` | Site institucional |
| `/areadolojista` | Área do lojista — tela de login isolada |

O mesmo SPA decide o que renderizar pelo pathname. `boomii-fidelidade.web.app`
continua respondendo (é o endereço padrão do Hosting) e serve exatamente o mesmo
conteúdo — útil enquanto o domínio próprio não termina de propagar.

### Duas decisões de implementação

**O link da Área do Lojista é relativo**, não absoluto. Em
`client/src/siteConfig.ts`, `URL_AREA_LOJISTA` é só o caminho, então resolve no
host que estiver servindo a página. Isso evita que o botão aponte para um
domínio que ainda não subiu durante a janela de propagação do DNS — e passa a
levar a `www.boomii.com.br/areadolojista` sozinho, assim que o domínio conectar.

**A tela de login é renderizada fora do layout do site**, sem cabeçalho nem
rodapé (`App.tsx`, o bloco `if (siteTab === 'login')`). Quem chega ali vai
entrar no sistema, não navegar pelo site; a navegação institucional só ofereceria
saídas acidentais no meio do login.

> O caminho anterior `/arealojista` — sem o "do" — continua reconhecido, assim
> como `/login` e `/entrar`. São rotas que podem ter circulado em links ou ficado
> em favoritos.

---

## Fase 0 — Pré-requisitos

- [ ] Node.js 20 (`node -v`). As Functions exigem a major 20.
- [ ] Firebase CLI: `npm install -g firebase-tools`
- [ ] `firebase login` com a conta que administra `mimo-2d6eb`
- [ ] Acesso ao registro.br com permissão para editar a zona DNS de
      `boomii.com.br`

---

## Fase 1 — Criar o site de Hosting novo

O projeto já tem o site `mimo-fidelidade`. Vamos adicionar um segundo, com a
marca nova, **no mesmo projeto**.

1. [ ] Console do Firebase → projeto `mimo-2d6eb` → **Hosting**.
2. [ ] **Adicionar outro site** → nome **`boomii-fidelidade`**.
       Isso gera `boomii-fidelidade.web.app`.
       O nome precisa bater com o campo `"site"` do `firebase.json`.
3. [ ] Se o nome estiver indisponível (é global no Firebase), escolha outro e
       faça um find-replace de `boomii-fidelidade` no repositório — ele aparece
       no `firebase.json`, em `client/.env.example`, `client/src/siteConfig.ts`,
       nas URLs de assets (`bannerGenerator.ts`, `boomiiWalletService.ts`,
       `functions/index.js`) e no `MainActivity.java` do APK.

Nada mais precisa ser configurado: Firestore, Storage, Functions, regras e
service account já existem e continuam valendo.

---

## Fase 2 — Publicar no `.web.app`

1. [ ] Apontar a CLI para o projeto:
       ```bash
       firebase use mimo-2d6eb
       ```
2. [ ] Instalar dependências, se ainda não:
       ```bash
       npm install
       npm --prefix client install
       npm --prefix functions install
       ```
3. [ ] Build do cliente:
       ```bash
       npm --prefix client run build
       ```
4. [ ] Publicar o site:
       ```bash
       firebase deploy --only hosting
       ```
       O `firebase.json` aponta para `boomii-fidelidade`, então o deploy vai
       para o site novo e **não** mexe no `mimo-fidelidade`.
5. [ ] Publicar as Functions, que mudaram na troca de marca (prefixo de QR,
       textos dos passes, nomes de campo):
       ```bash
       firebase deploy --only functions
       ```
6. [ ] Abrir `https://boomii-fidelidade.web.app` e conferir:
       - o header mostra o wordmark **BOOMII** com o infinito;
       - a tagline é **LOYALTY CLUB**;
       - o favicon é o infinito, não a carinha antiga.
7. [ ] Abrir `https://boomii-fidelidade.web.app/areadolojista` direto pela URL e
       confirmar que a tela de login aparece — isso valida o rewrite de SPA.
       A tela deve vir **sem cabeçalho e sem rodapé**, só o formulário.
8. [ ] Fazer login com uma conta de lojista e confirmar que o painel abre.

> **Se o login falhar aqui, pare.** O domínio próprio não conserta problema de
> configuração; resolva antes de seguir.

**Ao fim desta fase a área do lojista já está pronta e em produção.** O que vem
a seguir serve só para o site institucional ganhar o domínio próprio.

---

## Fase 3 — Domínio próprio no Firebase

Apenas **um** domínio: `www.boomii.com.br`.

1. [ ] Console → **Hosting** → site `boomii-fidelidade` →
       **Adicionar domínio personalizado**.
2. [ ] Informar `www.boomii.com.br` e avançar.
3. [ ] O console mostra um registro **TXT** para provar a posse do domínio.
       Criar no registro.br (fase 4) e voltar para clicar em **Verificar**.
4. [ ] Verificada a posse, o console mostra os registros **A** de destino.
       **Use exatamente os valores que ele exibir** — os IPs variam por projeto
       e mudam com o tempo, então não copie de documentação antiga nem daqui.
5. [ ] Criar esses registros A no registro.br.

### Apex (`boomii.com.br` sem o `www`)

Recomendado, para quem digitar o domínio sem o `www` não cair em erro:
adicione `boomii.com.br` como um segundo domínio no mesmo site e marque a opção
de **redirecionar** para `www.boomii.com.br`.

### O que muda ao acessar pelo domínio próprio

Os dois endereços servem o **mesmo** site, o mesmo bundle e as mesmas Functions,
então `www.boomii.com.br/areadolojista` tem exatamente as mesmas funções do
`.web.app`: login, painel, carimbo, resgate, Estúdio de Marca, CRM e relatórios.

Há, porém, dois pontos que **são** sensíveis ao domínio de origem:

1. **Link "Adicionar à Carteira" do Google.** O JWT de save-to-wallet carrega um
   claim `origins`, e o Google recusa o link se ele for acionado de um domínio
   fora da lista. Já está resolvido no código — ver `ORIGENS_PERMITIDAS` em
   `functions/index.js`, que inclui o `.web.app`, `www.boomii.com.br` e o apex.
   **Se um dia mudar de domínio, atualize essa lista e faça deploy das
   Functions**, senão o botão passa a falhar só no domínio novo.

2. **Restrições da chave de API.** A chave web do Firebase pode ter restrição
   de referenciador HTTP configurada no Google Cloud Console
   (APIs e Serviços → Credenciais). Se houver uma lista de domínios permitidos,
   `www.boomii.com.br/*` precisa entrar nela — caso contrário a autenticação e
   o Firestore falham só no domínio novo, com erro de chave inválida.
   - [ ] Verificar essa restrição antes de anunciar o domínio.

As Cloud Functions não bloqueiam por origem: as `onCall` não têm restrição
configurada e as `onRequest` (`getLogo`, `generateBanner`) usam `cors: true`.

---

## Fase 4 — Registros DNS no registro.br

1. [ ] <https://registro.br> → **Meus domínios** → `boomii.com.br`.
2. [ ] Abrir **Editar Zona DNS**.
       Só aparece se o domínio estiver usando os servidores DNS do próprio
       registro.br. Se estiver delegado a outro provedor (Cloudflare, por
       exemplo), crie os registros lá.
3. [ ] Criar os registros pedidos pelo Firebase:

| Tipo | Nome | Valor |
|---|---|---|
| TXT | conforme o console | conforme o console |
| A | `www` | IP 1 exibido pelo console |
| A | `www` | IP 2 exibido pelo console |

Se tiver adicionado o apex, o console pede também registros `A` no nome `@`.

4. [ ] Salvar e aguardar a propagação (de minutos a algumas horas).
5. [ ] Conferir:
       ```bash
       nslookup www.boomii.com.br
       ```

---

## Fase 5 — Certificado SSL

Emitido **automaticamente** pelo Firebase assim que o DNS propaga. Não há nada
a fazer além de esperar.

- [ ] O domínio fica como **"Pendente"** no console até o certificado sair.
      Costuma levar minutos; o Firebase reserva até 24 horas.
- [ ] Quando virar **"Conectado"**, testar `https://www.boomii.com.br`.

O `.web.app` responde normalmente o tempo todo, então a área do lojista não é
afetada por esta fase.

- [ ] Depois que o domínio estiver conectado, atualizar em `client/.env.local`:
      ```
      VITE_FIREBASE_HOSTING_URL=https://www.boomii.com.br
      ```
      e republicar. Essa URL é usada em links de passes e materiais gerados.

---

## Fase 6 — Trocar o `authDomain` (opcional)

Remove a referência a `mimo` no `authDomain` do bundle do cliente.

1. [ ] Console → **Authentication** → **Settings** → **Authorized domains** →
       adicionar `www.boomii.com.br`.
2. [ ] Em `client/.env.local`, descomentar:
       ```
       VITE_FIREBASE_AUTH_DOMAIN=www.boomii.com.br
       ```
3. [ ] Rebuild e redeploy:
       ```bash
       npm --prefix client run build && firebase deploy --only hosting
       ```
4. [ ] Confirmar que o login do lojista continua funcionando.

### Por que isso é seguro aqui

O `authDomain` só é usado no handshake OAuth de login federado
(`signInWithPopup` / `signInWithRedirect`), que leva o navegador a
`https://<authDomain>/__/auth/handler`. Este projeto autentica apenas por
`signInWithEmailAndPassword`, que fala direto com a API do Identity Toolkit —
o `authDomain` nunca é visitado.

Ainda assim, apontá-lo para o domínio próprio é o certo: o Firebase Hosting
serve os arquivos de `/__/auth/` em qualquer domínio personalizado ligado ao
mesmo projeto, então o valor fica correto caso um login com Google seja
adicionado no futuro.

> Isso **não** limpa o bundle por completo. Continuam lá o bucket de Storage,
> as URLs das Cloud Functions (`us-central1-mimo-2d6eb.cloudfunctions.net`) e as
> strings de retrocompatibilidade que são intencionais — o prefixo `mimo_` do
> localStorage e o User-Agent `MimoScannerApp`.

---

## Fase 7 — O que fazer com o site antigo

`mimo-fidelidade.web.app` continua no ar servindo o build anterior. **Não
apague.** Os passes já emitidos têm links apontando para ele, gravados dentro
do objeto da Google Wallet (`linksModuleData`) — apagar o site quebra esses
links nos cartões que já estão nas carteiras dos clientes.

**Já configurado no `firebase.json`.** Ele agora declara dois sites, e
`firebase deploy --only hosting` publica nos dois:

- `boomii-fidelidade` — o site principal;
- `mimo-fidelidade` — serve o **mesmo build**, com `redirects` 301 apenas nas
  rotas de navegação (`/`, `/precos`, `/areadolojista`, …).

Servir o mesmo build em vez de redirecionar tudo é deliberado: os assets que os
passes já emitidos referenciam (`/logos/**`, `/banners/**`) precisam continuar
respondendo **200**. O Google busca essas imagens no servidor, e um 301 pode
quebrá-las nos cartões que já estão nas carteiras dos clientes.

Pelo mesmo motivo, `/c/{slug}` — a página de cadastro do cliente — **não**
redireciona: convites QR já impressos apontam para lá. O domínio antigo também
foi mantido em `ORIGENS_PERMITIDAS` (`functions/index.js`) para que o botão
"Adicionar à Carteira" continue funcionando a partir dele.

- [ ] Reemitir os passes quando possível, para que passem a apontar para
      `www.boomii.com.br`.
- [ ] Só depois que os convites antigos saírem de circulação, remover
      `mimo-fidelidade.web.app` de `ORIGENS_PERMITIDAS` e o site do
      `firebase.json`.

---

## Fase 8 — Verificação final

- [ ] `https://www.boomii.com.br` abre o site institucional
- [ ] As quatro abas navegam: Início, Como funciona, Preços, Contato
- [ ] **Falar com a Boomii** leva ao formulário de contato
- [ ] **Área do Lojista** abre `https://www.boomii.com.br/areadolojista` em outra aba
- [ ] Essa tela aparece **sem cabeçalho e sem rodapé** — só o formulário de login
- [ ] Abrir esse endereço direto pela URL funciona (sem 404)
- [ ] Login do lojista entra no painel
- [ ] Emitir um cartão de teste e conferir se entra na carteira
- [ ] Carimbar pelo scanner e ver o saldo atualizar
- [ ] Carimbar um cartão **antigo** (emitido antes da troca) e confirmar que
      funciona — o parser aceita o prefixo de QR legado `MIMO:`
- [ ] Abrir a página de cadastro do cliente **pelo domínio próprio**
      (`www.boomii.com.br/c/{slug}`) e clicar em **Adicionar à Carteira**.
      Isso valida o claim `origins` do JWT do Google a partir do domínio novo.
- [ ] `contato@boomii.com.br` existe e recebe mensagens

---

## Nota sobre o APK do scanner

`android_native/.../MainActivity.java` tem o endereço do painel fixo no código:
`APP_URL` aponta para `https://boomii-fidelidade.web.app/painel?mode=app`, e há
uma checagem de host que libera a navegação dentro do WebView apenas para
`boomii-fidelidade.web.app` e `boomii-fidelidade.firebaseapp.com`.

Como a área do lojista fica mesmo no `.web.app`, isso já está correto e não
precisa mudar. Se um dia o endereço mudar, os **dois** pontos precisam ser
atualizados juntos — trocar só o `APP_URL` faz o WebView tratar o próprio painel
como link externo.

---

## Pendências fora deste runbook

Não bloqueiam a publicação do site, mas bloqueiam a emissão de passes com a
marca nova. Ver `12-migracao-marca.md`:

- Registrar o Pass Type ID `pass.com.boomii.fidelidade` na Apple e emitir o
  certificado. Passes sob o ID antigo não migram.
- Publicar o app Android com o `applicationId` `com.boomii.scanner`. O Google
  Play trata como aplicativo novo, sem atualização automática.
- Substituir a arte herdada da marca antiga: `boomii-logo.jpg`,
  `boomii-hero.jpg`, `boomii-hero-zero.jpg` e `mascote-hero.jpg`. É o único
  item que sobrou e depende de design, não de código.

> Os segredos (`JWT_SECRET`, `ADMIN_SECRET_KEY`) já foram rotacionados e o
> ícone do Android já é o infinito Boomii. Ver `12-migracao-marca.md`.
