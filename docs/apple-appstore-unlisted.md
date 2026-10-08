# Guia de Publicação do Boomii na App Store (App Não Listado) & Relatório de Segurança

Este documento detalha o pipeline seguro de compilação na nuvem (sem necessidade de um computador Mac físico), as **fragilidades de segurança identificadas e mitigadas**, os **cuidados contra rejeição pelas diretrizes da Apple** e o passo a passo completo para aprovação como **App Não Listado (Unlisted App Distribution)**.

---

## 1. Auditoria de Segurança: Fragilidades Identificadas e Mitigações

Ao transformar uma aplicação web em um aplicativo móvel iOS e automatizar sua compilação via CI/CD, diversas vulnerabilidades graves podem surgir se os devidos cuidados não forem tomados:

| # | Fragilidade de Segurança | Risco | Mitigação Implementada no Projeto |
|---|---|---|---|
| **1** | **Vazamento de Chaves Privadas no Git** | Comprometimento da conta Apple Developer se arquivos de chave (`.key`, `.p8`, `.p12`) forem commitados. Um commit posterior NÃO remove o arquivo do histórico do Git. | 1. O script [scripts/gerar_credenciais_ios.cjs](../scripts/gerar_credenciais_ios.cjs) gera tudo dentro da pasta isolada `.credentials/`.<br>2. O [.gitignore](../.gitignore) ignora estritamente `*.key`, `*.pem`, `*.p8`, `*.p12`, `*.cer`, `*.csr`, `*.mobileprovision`, `AuthKey_*.p8`, `*.base64.txt`, `distribution.*`, `pass.*` e `.credentials/`.<br>3. Instruções de commit usam `git status` e staging explícito (nunca `git add .` às cegas). |
| **2** | **Exposição de Senha no Histórico do Shell** | Passar senhas como argumento de linha de comando (`npm run ... senha`) grava a senha em texto claro no `ConsoleHost_history.txt` (PowerShell) ou `~/.bash_history`. | O utilitário [scripts/gerar_credenciais_ios.cjs](../scripts/gerar_credenciais_ios.cjs) solicita a senha de forma interativa via terminal (`readline`) ou lê da variável de ambiente `APPLE_CERT_PASSWORD`. |
| **3** | **Segredos de CI/CD Expostos a Qualquer Colaborador** | Em repositórios de equipe, qualquer pessoa com permissão de escrita poderia criar ou editar uma action para imprimir secrets nos logs. | O workflow [.github/workflows/deploy-ios.yml](../.github/workflows/deploy-ios.yml) utiliza um **GitHub Environment** (`production`), permitindo configurar proteção de reviewers obrigatórios para autorizar o uso dos segredos. Além disso, usa chaveiro com senha aleatória efêmera e limpeza destrutiva no bloco `always()`. |
| **4** | **Sequestro de Navegação / Phishing no WKWebView** | Um atacante ou script malicioso poderia redirecionar a tela nativa para um site falso enquanto o lojista acredita estar no app. | Em [capacitor.config.ts](../capacitor.config.ts), configurado `server.allowNavigation` com uma lista estrita (whitelist) apenas dos domínios oficiais da Boomii e Firebase, bloqueando qualquer navegação externa arbitrária. |
| **5** | **Tráfego HTTP em Texto Claro (MitM)** | Interceptação de dados na rede local (Wi-Fi de loja) caso o app faça requisições sem TLS. | Forçado `iosScheme: 'https'` no Capacitor e configurado App Transport Security (ATS) estrito com `NSAllowsArbitraryLoads: false` em [Info.plist](../ios/App/App/Info.plist). |
| **6** | **Injeção de Scripts (XSS) no App Nativo** | Scripts maliciosos poderiam tentar invocar plugins nativos através da ponte JavaScript/Nativa. | 1. Como o app empacota o HTML localmente (`webDir: 'client/dist'`), a meta tag de **Content-Security-Policy (CSP)** em [client/index.html](../client/index.html) é efetiva no WKWebView.<br>2. *(Atenção: se você algum dia alterar `capacitor.config.ts` para usar `server.url` apontando para a web, a CSP do HTML empacotado deixa de valer e passa a valer apenas os headers HTTP do servidor de hospedagem).* |
| **7** | **Permissões Nativas Excessivas (Rejeição Apple 5.1.1)** | Pedir permissões desnecessárias amplia a superfície de ataque e causa rejeição na avaliação da Apple. | Declarada exclusivamente a permissão de câmera (`NSCameraUsageDescription`) em [Info.plist](../ios/App/App/Info.plist), justificando o uso restrito à leitura de QR Codes no balcão. |

> [!CAUTION]
> **Atenção sobre Chaves no Histórico do Git:**
> Se uma chave privada (`.key`, `.p8`, `.p12`) já foi commitada no passado, **apenas apagá-la no commit seguinte não resolve o problema**, pois ela continua legível no histórico do Git. Se isso tiver ocorrido, revogue imediatamente o certificado no portal Apple Developer e gere um novo.

---

## 2. Riscos de Rejeição na Apple e Como o Boomii está Protegido

Além da segurança, a publicação na Apple possui diretrizes rigorosas que frequentemente barram aplicativos híbridos:

### 2.1. Guideline 4.2: Funcionalidade Mínima (O risco do "Web Wrapper")
A Apple rejeita apps que são meros "sites empacotados em WebView" se não demonstrarem valor nativo para o dispositivo.
* **Como o Boomii atende a essa exigência:**
  1. **Uso de Câmera de Hardware**: Leitor de QR Code para leitura rápida de cartões no balcão (scanner de checkout em tempo real).
  2. **Integração com Carteira Digital**: Emissão e tratamento de passes Apple Wallet (`.pkpass`).
  3. **Interface Adaptada**: Detecção de ambiente nativo (`isAppMode` / Capacitor), tela sem elementos de navegação de browser e suporte a Safe Area do iPhone.

### 2.2. Privacy Manifest Obrigatório (`PrivacyInfo.xcprivacy`)
Desde 1º de maio de 2024, a Apple exige o arquivo `PrivacyInfo.xcprivacy` para todos os apps e bibliotecas que usam certas APIs de sistema ("Required Reason APIs"):
* Criamos o arquivo [ios/App/App/PrivacyInfo.xcprivacy](../ios/App/App/PrivacyInfo.xcprivacy) declarando:
  - `NSPrivacyTracking = false` (não faz tracking entre apps de terceiros).
  - Categorias de APIs do Capacitor: `UserDefaults` (preferências locais), `FileTimestamp` (cache do web assets), `SystemBootTime` e `DiskSpace`.

### 2.3. Isenção de Criptografia (`ITSAppUsesNonExemptEncryption`)
Para evitar que o App Store Connect trave a build a cada upload perguntando se o app usa criptografia proprietária:
* Adicionado `<key>ITSAppUsesNonExemptEncryption</key><false/>` em [ios/App/App/Info.plist](../ios/App/App/Info.plist), declarando que o app utiliza apenas conexões HTTPS/TLS padrão isentas das normas de exportação dos EUA.

---

## 3. Modelo de Distribuição: "App Não Listado" vs "Custom App (ABM)"

> [!IMPORTANT]
> **"Link Secreto" NÃO é Controle de Acesso!**
> A distribuição como **App Não Listado** apenas retira o aplicativo da busca pública, dos rankings e das categorias da App Store. **Qualquer pessoa que possuir o link direto conseguirá baixar o app**.
> Portanto, a proteção real dos dados da sua empresa reside exclusivamente no **sistema de autenticação e autorização** (login do lojista via Firebase Auth com regras restritas no Firestore).

* **App Não Listado (Nossa Escolha)**: Ideal para o Boomii. Cada lojista parceiro acessa um link direto no seu painel web e instala o app em qualquer iPhone comercial ou pessoal sem precisar de cadastros burocráticos.
* **Custom App via Apple Business Manager (Alternativa mais restrita)**: Permite limitar a instalação estritamente aos números D-U-N-S ou contas corporativas das empresas parceiras. Porém, exige que cada lojista tenha uma conta corporativa no Apple Business Manager e um sistema de MDM, o que costuma ser inviável para pequenos comércios.

---

## 4. Passo a Passo Seguro no Windows (Sem Mac)

### Passo 4.1: Gerar a Chave de Distribuição e CSR
No terminal, execute:
```bash
npm run ios:creds csr
```
* Os arquivos `distribution.key` e `distribution.csr` serão salvos de forma isolada na pasta `.credentials/` (que está no `.gitignore`).

### Passo 4.2: Obter o Certificado no Apple Developer
1. Acesse: [developer.apple.com/account/resources/certificates/add](https://developer.apple.com/account/resources/certificates/add)
2. Selecione **Apple Distribution** e clique em *Continue*.
3. Faça o upload do arquivo `.credentials/distribution.csr`.
4. Baixe o certificado gerado e salve-o em `.credentials/distribution.cer`.

### Passo 4.3: Criar o Perfil de Provisionamento (.mobileprovision)
1. Acesse [developer.apple.com/account/resources/profiles/add](https://developer.apple.com/account/resources/profiles/add)
2. Selecione **App Store** (sob *Distribution*) e clique em *Continue*.
3. Selecione o App ID `com.boomii.lojista`.
4. Selecione o certificado de distribuição criado anteriormente.
5. Dê um nome ao perfil (ex: `Boomii Lojista AppStore`), baixe o arquivo e salve em `.credentials/profile.mobileprovision`.

### Passo 4.4: Gerar o P12 e os Arquivos Base64
Execute no terminal (o script pedirá a senha de forma interativa, sem gravar no histórico do shell):
```bash
# Solicita a senha de forma interativa e segura:
npm run ios:creds p12

# Converte o perfil de provisionamento para Base64:
npm run ios:creds prov
```
* Os arquivos `.credentials/distribution.p12.base64.txt` e `.credentials/profile.base64.txt` serão gerados prontos para cadastro no GitHub.

---

## 5. Configurar os Segredos no GitHub (com Environment Seguro)

1. No seu repositório no GitHub, acesse **Settings** > **Environments** > **New environment** e crie um ambiente chamado **`production`**.
   *(Opcional recomendado: em "Deployment branches and tags", restrinja para a branch `main`, e em "Required reviewers", adicione você mesmo para aprovar execuções).*
2. Dentro do ambiente `production` (ou em *Settings > Secrets and variables > Actions*), adicione os seguintes segredos:

| Nome do Segredo | Conteúdo |
| :--- | :--- |
| `APPLE_CERTIFICATE_P12` | Conteúdo do arquivo `.credentials/distribution.p12.base64.txt` |
| `APPLE_CERTIFICATE_PASS`| A senha que você digitou ao gerar o P12 |
| `APPLE_PROVISIONING_PROFILE` | Conteúdo do arquivo `.credentials/profile.base64.txt` |
| `APP_STORE_KEY_ID` | Key ID da chave da API do App Store Connect (ex: `AB12CD34EF`) |
| `APP_STORE_ISSUER_ID` | Issuer ID da conta do App Store Connect |
| `APP_STORE_PRIVATE_KEY` | Conteúdo inteiro do arquivo `.p8` da chave de API |

---

## 6. Realizando o Commit Seguro e Disparando o Deploy

1. Verifique que nenhuma credencial está sendo adicionada:
   ```bash
   git status
   ```
2. Adicione **explicitamente** apenas os arquivos de código:
   ```bash
   git add capacitor.config.ts ios/ client/ docs/ scripts/ package.json
   git commit -m "feat(ios): pipeline seguro de build e conformidade app store"
   git push origin main
   ```
3. No GitHub, abra a aba **Actions** > selecione **"Build & Deploy iOS (App Store / Unlisted)"**.
4. Clique em **Run workflow**. O runner macOS compilará o `.ipa` e enviará automaticamente ao App Store Connect.

---

## 7. Como Solicitar o Status de "App Não Listado" (Unlisted App)

1. Acesse o formulário oficial da Apple:
   👉 **[developer.apple.com/contact/request/unlisted-app/](https://developer.apple.com/contact/request/unlisted-app/)**

2. Preencha o formulário com o modelo abaixo:

### Justificativa para a Apple:
* **App Name**: `Boomii Lojista`
* **Bundle ID**: `com.boomii.lojista`
* **Why should this app be unlisted rather than distributed on the public App Store?**
  > *"O aplicativo Boomii Lojista é uma ferramenta operacional estritamente B2B destinada aos caixas e operadores de lojas parceiras credenciadas na plataforma Boomii Fidelidade. A aplicação é utilizada exclusivamente nos terminais de atendimento para escanear os códigos QR dos cartões de carteira digital (Apple Wallet) dos clientes e creditar selos de fidelidade. Como o aplicativo não possui catálogo público, funcionalidades abertas ao consumidor final e requer credenciais corporativas pré-existentes de lojista para acesso, sua presença na busca pública da App Store não traria utilidade para o público em geral."*
* **How will users obtain the app?**
  > *"O link direto da App Store será disponibilizado de forma privada dentro do painel administrativo web dos lojistas parceiros homologados."*

3. **Prazo de Avaliação**: Geralmente leva alguns dias úteis (a Apple não garante prazos fixos).
4. Assim que deferido, a opção *"Distribuição de app não listado"* ficará ativa nas configurações de preço e disponibilidade no App Store Connect.

### 7.1. Dados para o Revisor da Apple (App Review Notes)
Para evitar rejeição por falta de teste:
1. Em **Informações de Início de Sessão para Revisão**, forneça login e senha de uma conta lojista de demonstração (`demo@boomii.com.br`).
2. **QR Code de Teste para o Revisor**: No campo de notas da revisão (*Notes*), inclua um link direto para uma imagem de QR Code válido (ou anexe nas notas) com a seguinte instrução:
   > *"Para testar o leitor de QR Code do caixa: faça login com a conta de demonstração, acione o botão de leitura da câmera e aponte para o QR Code de teste em: https://boomii-fidelidade.web.app/logos/qr-demo.png"*.
