# 12 — Migração de marca: Mimo → Boomii

Troca da marca "Mimo" por "Boomii" motivada por interferência legal no uso do
nome e do logotipo anteriores. Este documento registra o que já foi alterado no
código e o que **só pode ser feito fora do repositório**, em consoles de
terceiros. Enquanto os itens da seção 2 não forem concluídos, a aplicação
compila e passa no typecheck, mas **não conecta a nenhum backend**.

## 1. O que já está feito no código

| Camada | Alteração |
|---|---|
| Texto visível | ~530 ocorrências de `Mimo`/`MIMO`/`mimo` → `Boomii`/`BOOMII`/`boomii` |
| Logotipo | `BoomiiLogo` e `BoomiiWordmark` reescritos: wordmark **BOOMII** com o símbolo de infinito em SVG no lugar do par "OO" |
| Tagline | Assinatura institucional "Fidelidade Digital" → **"Loyalty Club"** |
| Tokens de estilo | `mimo-yellow`, `btn-mimo`, `input-mimo-dark`, `--mimo-*` → prefixo `boomii-*` (valores hexadecimais **inalterados**, conforme decidido) |
| Componentes | `MimoLogo`, `MimoMobileApp`, `MimoDesktopShell`, `MimoGalleryView`, `mimoWalletService` renomeados (arquivos e imports) |
| Pacote Android | `com.mimo.scanner` → `com.boomii.scanner` (diretório Java movido) |
| Apple Wallet | Pass Type ID → `pass.com.boomii.fidelidade` |
| Firebase | Projeto **mantido** em `mimo-2d6eb` (ID imutável); site de Hosting novo `boomii-fidelidade` + domínio `boomii.com.br` |
| Assets | `public/mimo-logo.jpg`, `mimo-hero.jpg`, `mimo-hero-zero.jpg` → `boomii-*.jpg` |
| Docs | `10-marca-mimo.md` → `10-marca-boomii.md`; demais docs renomeados |

### Palavra "mimo" como substantivo comum

Em português, *mimo* é substantivo comum (agrado, brinde). Vários trechos usavam
a palavra nesse sentido, **não** como marca, e foram trocados por vocabulário
neutro em vez de virarem "Boomii":

- campo `fields.mimo` → `fields.recompensa` (contrato `CardDesign`);
- `premio_mimo` → `premio_recompensa` (textModules da Google Wallet);
- `"MIMO APÓS 10 COMPRAS"` → `"RECOMPENSA APÓS 10 COMPRAS"`;
- `"PRÊMIO DO MIMO"` → `"SUA RECOMPENSA"`;
- `"1 Mimo Especial"` → `"1 Recompensa Especial"`.

> O nome do programa do lojista (`"Programa de Fidelidade Digital"`) foi mantido:
> é configuração por loja, não assinatura da plataforma.

### Compatibilidade retroativa deliberada

Estes pontos ainda reconhecem a marca antiga **de propósito**. Não remova sem
confirmar que a base correspondente já rodou:

| Onde | O quê | Por quê |
|---|---|---|
| `functions/index.js` (carimbar) | aceita prefixo de QR `MIMO:` além de `BOOMII:` | Cartões já emitidos estão nas carteiras dos clientes e não podem ser reemitidos remotamente |
| `client/src/utils/brandMigration.ts` | copia chaves `mimo_*` → `boomii_*` no boot | Sem isso, todo lojista é deslogado e perde a config local do cartão no primeiro acesso após o deploy |
| `client/src/App.tsx` | aceita User-Agent `MimoScannerApp` | APKs já instalados continuam enviando o UA antigo até a base atualizar |

## 2. Ações externas obrigatórias

Nenhuma destas pode ser feita a partir do repositório.

### 2.1 Firebase — projeto mantido

**Decisão:** o projeto continua sendo `mimo-2d6eb`. O ID de um projeto Firebase
é imutável, e trocá-lo exigiria criar um projeto do zero e migrar Firestore,
Storage, Functions e credenciais. A marca nova entra pelo domínio
`boomii.com.br` e por um site de Hosting novo dentro do mesmo projeto.

Portanto **não há** criação de projeto, troca de credenciais nem migração de
dados. O passo a passo está em `13-dominio-e-publicacao.md`.

**Consequência a registrar:** `mimo-2d6eb` permanece visível no bucket de
Storage e nas URLs das Cloud Functions — endereços que qualquer pessoa vê ao
inspecionar o tráfego da página.

O `authDomain` **não** entra nessa lista: ele é trocável por
`www.boomii.com.br` sem migrar projeto, porque o Firebase Hosting serve os
arquivos de `/__/auth/` em qualquer domínio personalizado do mesmo projeto.
Além disso, ele é inerte aqui — o projeto autentica só por
`signInWithEmailAndPassword`, que não usa o fluxo OAuth. Ver fase 6 de
`13-dominio-e-publicacao.md`.

Se a restrição legal alcançar também Storage e Functions, a migração de projeto
volta à mesa; nesse caso será preciso criar o projeto novo, migrar o Firestore
por `gcloud firestore export`/`import`, gerar um service account novo e
preencher os seis `VITE_FIREBASE_*` em `client/.env.local`.

### 2.2 Credenciais — nunca editar o JSON

`service-account-wallet.json` (raiz e `functions/`) contém uma chave privada
real do service account `mimo-wallet-issuer@mimo-2d6eb`, que **continua válida**
porque o projeto não mudou.

Esses arquivos foram deixados intactos de propósito: editar o `project_id` ou o
`client_email` de um JSON de service account invalida a credencial, porque os
campos precisam corresponder ao recurso que existe no GCP. O rename em massa
chegou a alterá-los e a mudança foi revertida.

Independentemente da migração, vale **rotacionar essa chave**: ela está em texto
plano no disco. Ambos os arquivos estão cobertos pelo `.gitignore`, então não
vazaram para o histórico do git.

### 2.3 Apple Wallet

1. Registrar o Pass Type ID **`pass.com.boomii.fidelidade`** no Apple Developer.
2. Emitir o certificado de assinatura correspondente e apontar
   `APPLE_CERT_P12_PATH` para ele.
3. Preencher `APPLE_TEAM_ID` com o Team ID real (hoje é um valor de exemplo).

> Passes já emitidos sob `pass.com.mimo.fidelidade` **não migram**. Eles
> continuam funcionando enquanto o certificado antigo for válido, mas param de
> receber atualizações quando ele for revogado. Planeje a reemissão.

### 2.4 Google Play

`applicationId` mudou para `com.boomii.scanner`. O Google Play trata isso como
um **aplicativo novo**: nova ficha na loja, e a base instalada não recebe
atualização automática. É preciso comunicar os lojistas e distribuir o APK novo.

### 2.5 Segredos — rotacionados

`JWT_SECRET` e `ADMIN_SECRET_KEY` foram substituídos por valores aleatórios de
48 bytes no `.env`. Antes eram frases descritivas, não segredos.

Ao rotacionar, dois problemas apareceram e foram corrigidos:

1. **`save-link.ts` tinha o segredo embutido como fallback.** Um valor conhecido
   no código anula a rotação — qualquer um poderia forjar o token. Agora a
   função falha alto se `JWT_SECRET` não estiver definido.
2. **O `.env` nunca era carregado.** O pacote `dotenv` estava nas dependências
   mas não era importado em lugar nenhum, então `process.env` só tinha o que o
   ambiente externo fornecesse. Foi adicionado `import 'dotenv/config'` em
   `src/server.ts` e em `src/tests/run-all.ts`.

> `ADMIN_SECRET_KEY` não é lido por nenhum código. Ficou no `.env` como
> configuração reservada; se não houver uso previsto, pode ser removido.

## 3. Marca gráfica

### Já substituído

- **Símbolo oficial** (`client/src/assets/boomii-infinito.png`): o arquivo da
  marca, recortado do material enviado (394×202, com transparência). Usado no
  `BoomiiLogo` e no `BoomiiWordmark`, no lugar da lemniscata que havia sido
  traçada à mão como aproximação — o símbolo real são dois anéis sobrepostos
  com recortes diagonais no cruzamento, geometria diferente da aproximação.
- **Favicon e ícones** (`client/public/`): era a carinha do mascote antigo em
  data URI. Agora são PNGs gerados do ícone oficial *stacked* (B∞ / MII sobre
  quadrado grafite arredondado): `favicon.png` (256), `apple-touch-icon.png`
  (180) e o master `boomii-icon.png` (1024).
- **Selos do cartão** (`src/imaging/stamp-grid.ts`): cada selo conquistado
  desenhava o rosto do mascote (arco de sorriso + dois olhos) dentro da moeda.
  Esse SVG é gerado no servidor e vai para a *strip image* dos passes reais —
  ou seja, a marca antiga estava sendo impressa em todo cartão emitido. Ficou
  só a moeda dourada, coerente com a regra de que o cartão carrega a marca do
  lojista e não a da plataforma.
- **Ícone do Android**: era um placeholder roxo (`#7c3aed`) do template, depois
  um vetor aproximado. Agora são PNGs nos cinco buckets de densidade
  (`mipmap-mdpi` a `mipmap-xxxhdpi`, de 48 a 192 px), gerados do master em
  `android_native/ic_launcher-master.png` por média de área — bilinear serrilha
  demais numa redução de 1024 px. O `AndroidManifest.xml` passou a referenciar
  `@mipmap/ic_launcher`.

  > O arquivo antigo `res/drawable/ic_launcher.xml` ficou no disco sem ser
  > referenciado por nada. Pode ser apagado com segurança.

### Um único ícone em tudo: **B∞**

| Onde | Tamanho | Arquivo |
|---|---|---|
| Favicon do navegador | 256 px (o navegador reduz) | `client/public/favicon.png` |
| Atalho no iOS | 180 px | `client/public/apple-touch-icon.png` |
| Aplicativo Android | 48 a 192 px | `android_native/.../mipmap-*/ic_launcher.png` |

Todos saem do mesmo master, `android_native/ic_launcher-master.png`, reduzidos
por média de área — bilinear serrilha demais partindo de 1024 px.

Os dois endereços (`www.boomii.com.br` e `boomii-fidelidade.web.app`) servem o
**mesmo deploy**, então um único `favicon.png` cobre os dois. Ver uma aba com o
ícone antigo e outra com o novo é cache do navegador, não divergência de
publicação.

> Houve duas variantes antes: a empilhada (B∞ / MII) e o infinito sozinho. A
> empilhada ficava ilegível em 16 px e foi descartada; o infinito sozinho perdia
> a identificação da marca. O B∞ resolve os dois — conferido em 16 e 32 px.
>
> `client/public/boomii-icon.png` é o resto da versão empilhada e não é
> referenciado por nada. Pode ser apagado.

### Pendente — exige arte, não código

Só restam arquivos de imagem, que precisam ser redesenhados:

- `client/public/boomii-logo.jpg`, `boomii-hero.jpg` e `boomii-hero-zero.jpg`
  foram **renomeados, não redesenhados**: o conteúdo ainda é a arte antiga.
- `client/src/assets/mascote-hero.jpg`, usado na home (`SiteHome.tsx`), é o
  mascote antigo. Confirmar com a assessoria jurídica se a restrição o alcança.
- A paleta foi mantida por decisão explícita. O brandbook Boomii especifica
  `#FFD21F` / `#090909` / `#151515`; o código segue em `#FFC82C` / `#0F0F10` /
  `#16161A`. Alinhar quando quiser adotar a paleta nova.
