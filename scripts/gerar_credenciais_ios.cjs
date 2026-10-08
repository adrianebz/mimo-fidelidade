/**
 * Script utilitário seguro para geração e conversão de credenciais da Apple
 * no Windows (dispensa Mac/Keychain).
 *
 * BOAS PRÁTICAS DE SEGURANÇA APLICADAS:
 * 1. Todos os arquivos são gerados na pasta isolada ".credentials/" (já inclusa no .gitignore).
 * 2. A senha do P12 pode ser informada interativamente no terminal ou via variável de ambiente,
 *    evitando gravar a senha no histórico do terminal (ConsoleHost_history.txt / bash_history).
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const forge = require('node-forge');

const CRED_DIR = path.join(process.cwd(), '.credentials');
if (!fs.existsSync(CRED_DIR)) {
  fs.mkdirSync(CRED_DIR, { recursive: true });
}

const comando = process.argv[2];

function derToPem(derBuffer) {
  const derStr = forge.util.createBuffer(derBuffer.toString('binary'));
  const asn1 = forge.asn1.fromDer(derStr);
  const cert = forge.pki.certificateFromAsn1(asn1);
  return forge.pki.certificateToPem(cert);
}

function promptPassword(callback) {
  if (process.env.APPLE_CERT_PASSWORD) {
    return callback(process.env.APPLE_CERT_PASSWORD);
  }
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Digite a senha para proteger o certificado P12: ', (answer) => {
    rl.close();
    if (!answer || answer.trim().length < 6) {
      console.error('Erro: A senha deve ter no mínimo 6 caracteres.');
      process.exit(1);
    }
    callback(answer.trim());
  });
}

if (comando === 'csr') {
  console.log('Gerando chave privada RSA 2048 para Apple Distribution...');
  forge.pki.rsa.generateKeyPair({ bits: 2048 }, (err, keypair) => {
    if (err) {
      console.error('Erro ao gerar chave:', err);
      process.exit(1);
    }
    const keyPath = path.join(CRED_DIR, 'distribution.key');
    const csrPath = path.join(CRED_DIR, 'distribution.csr');

    const privateKeyPem = forge.pki.privateKeyToPem(keypair.privateKey);
    fs.writeFileSync(keyPath, privateKeyPem);
    console.log(`✔ Chave privada salva em "${keyPath}"`);

    const csr = forge.pki.createCertificationRequest();
    csr.publicKey = keypair.publicKey;
    csr.setSubject([
      { name: 'commonName', value: 'Boomii Lojista Distribution' },
      { name: 'countryName', value: 'BR' },
      { name: 'organizationName', value: 'Boomii' },
      { name: 'emailAddress', value: 'contato@boomii.com.br' },
    ]);
    csr.sign(keypair.privateKey, forge.md.sha256.create());
    const csrPem = forge.pki.certificationRequestToPem(csr);
    fs.writeFileSync(csrPath, csrPem);

    console.log(`✔ CSR gerado com sucesso em "${csrPath}"`);
    console.log('\n======================================================');
    console.log('Próximos passos seguros:');
    console.log('1. Acesse: developer.apple.com > Certificates > (+) > Apple Distribution');
    console.log(`2. Faça o upload do arquivo: ${csrPath}`);
    console.log(`3. Baixe o certificado e salve em: ${path.join(CRED_DIR, 'distribution.cer')}`);
    console.log('======================================================');
  });
} else if (comando === 'p12') {
  const cerPath = path.join(CRED_DIR, 'distribution.cer');
  const keyPath = path.join(CRED_DIR, 'distribution.key');

  if (!fs.existsSync(cerPath) || !fs.existsSync(keyPath)) {
    console.error(`Erro: Certifique-se de que "distribution.cer" e "distribution.key" estão na pasta "${CRED_DIR}".`);
    process.exit(1);
  }

  promptPassword((senha) => {
    try {
      const cerBuffer = fs.readFileSync(cerPath);
      const certPem = derToPem(cerBuffer);
      const keyPem = fs.readFileSync(keyPath, 'utf8');

      const privateKey = forge.pki.privateKeyFromPem(keyPem);
      const cert = forge.pki.certificateFromPem(certPem);

      const p12Asn1 = forge.pkcs12.toPkcs12Asn1(privateKey, [cert], senha, {
        generateLocalKeyId: true,
        friendlyName: 'Boomii Distribution Certificate',
      });
      const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
      const p12Buffer = Buffer.from(p12Der, 'binary');

      const p12Path = path.join(CRED_DIR, 'distribution.p12');
      fs.writeFileSync(p12Path, p12Buffer);
      console.log(`✔ Certificado P12 gerado em: "${p12Path}"`);

      const base64 = p12Buffer.toString('base64');
      const base64Path = path.join(CRED_DIR, 'distribution.p12.base64.txt');
      fs.writeFileSync(base64Path, base64);
      console.log(`✔ Texto Base64 salvo em: "${base64Path}"`);

      console.log('\n======================================================');
      console.log('Próximos passos no GitHub Secrets:');
      console.log('1. Cole o conteúdo de "distribution.p12.base64.txt" no secret: APPLE_CERTIFICATE_P12');
      console.log('2. Cadastre a senha utilizada no secret: APPLE_CERTIFICATE_PASS');
      console.log('======================================================');
    } catch (err) {
      console.error('Erro ao converter para P12:', err);
    }
  });
} else if (comando === 'prov') {
  let arq = process.argv[3];
  if (!arq) {
    const defaultInCred = path.join(CRED_DIR, 'profile.mobileprovision');
    if (fs.existsSync(defaultInCred)) arq = defaultInCred;
    else if (fs.existsSync('profile.mobileprovision')) arq = 'profile.mobileprovision';
  }

  if (!arq || !fs.existsSync(arq)) {
    console.error(`Erro: Perfil .mobileprovision não encontrado. Coloque o arquivo em "${CRED_DIR}/profile.mobileprovision".`);
    process.exit(1);
  }

  const buf = fs.readFileSync(arq);
  const base64 = buf.toString('base64');
  const outPath = path.join(CRED_DIR, 'profile.base64.txt');
  fs.writeFileSync(outPath, base64);
  console.log(`✔ Perfil convertido! Base64 salvo em: "${outPath}"`);
  console.log('Cole o conteúdo no secret do GitHub: APPLE_PROVISIONING_PROFILE');
} else {
  console.log('Utilitário Seguro de Credenciais iOS (Armazenamento em .credentials/)');
  console.log('Comandos disponíveis:');
  console.log('  node scripts/gerar_credenciais_ios.cjs csr');
  console.log('  node scripts/gerar_credenciais_ios.cjs p12');
  console.log('  node scripts/gerar_credenciais_ios.cjs prov [caminho]');
}
