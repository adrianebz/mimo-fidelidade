/**
 * Valida a assinatura de passes da Apple com o certificado real.
 *
 * Confere, em um só lugar: se o .p12 abre com a senha, se o certificado é o do
 * Pass Type ID esperado, se o WWDR está correto e se a assinatura gerada é um
 * PKCS#7 destacado em DER — o formato que o iOS exige.
 *
 * Uso (a senha vem do ambiente, nunca da linha de comando, para não ficar no
 * histórico do shell):
 *
 *   # PowerShell
 *   $env:APPLE_KEY_PASSPHRASE='...'; node functions/validar-assinatura.js
 *
 *   # bash
 *   APPLE_KEY_PASSPHRASE='...' node functions/validar-assinatura.js
 */
const fs = require('fs');
const path = require('path');
const forge = require('node-forge');
const { assinarManifest, abrirP12, lerCertificado, pareceAssinaturaValida } = require('./apple-pass.js');

const RAIZ = path.join(__dirname, '..');
const SENHA = process.env.APPLE_KEY_PASSPHRASE;
const CAMINHO_P12 = process.env.APPLE_CERT_P12_PATH || path.join(RAIZ, 'pass.p12');
const CAMINHO_WWDR = process.env.APPLE_WWDR_PATH || path.join(RAIZ, 'AppleWWDRCAG4.cer');

const PASS_TYPE_ID_ESPERADO = process.env.APPLE_PASS_TYPE_ID || 'pass.com.boomii.fidelidade';

function falhar(msg) {
  console.error(`\n✗ ${msg}`);
  process.exit(1);
}

if (!SENHA) {
  falhar('Defina APPLE_KEY_PASSPHRASE no ambiente antes de rodar.');
}

const p12 = fs.readFileSync(path.resolve(RAIZ, CAMINHO_P12));
const wwdr = fs.readFileSync(path.resolve(RAIZ, CAMINHO_WWDR));

let certificado;
try {
  ({ certificado } = abrirP12(p12, SENHA));
} catch (e) {
  falhar(`Não foi possível abrir o .p12: ${e.message}`);
}

console.log('=== certificado do Pass Type ID ===');
const uid = certificado.subject.attributes.find((a) => a.type === '0.9.2342.19200300.100.1.1');
const cn = certificado.subject.getField('CN');
const ou = certificado.subject.getField('OU');
const org = certificado.subject.getField('O');
console.log(`  Pass Type ID : ${uid ? uid.value : '(não encontrado)'}`);
console.log(`  CN           : ${cn ? cn.value : '-'}`);
console.log(`  Team ID (OU) : ${ou ? ou.value : '-'}`);
console.log(`  Titular      : ${org ? org.value : '-'}`);
console.log(`  Validade     : ate ${certificado.validity.notAfter.toISOString().slice(0, 10)}`);

const vencido = certificado.validity.notAfter < new Date();
if (vencido) falhar('O certificado do Pass Type ID está expirado.');
if (uid && uid.value !== PASS_TYPE_ID_ESPERADO) {
  falhar(`O certificado é de "${uid.value}", mas APPLE_PASS_TYPE_ID diz "${PASS_TYPE_ID_ESPERADO}".`);
}

const wwdrCert = lerCertificado(wwdr);
const wwdrCn = wwdrCert.subject.getField('CN');
console.log('\n=== WWDR ===');
console.log(`  CN       : ${wwdrCn ? wwdrCn.value : '-'}`);
console.log(`  Validade : ate ${wwdrCert.validity.notAfter.toISOString().slice(0, 10)}`);
if (wwdrCert.validity.notAfter < new Date()) falhar('O certificado WWDR está expirado.');

const manifest = Buffer.from(
  JSON.stringify({ 'pass.json': 'a'.repeat(40), 'icon.png': 'b'.repeat(40) }, null, 2),
  'utf8'
);

let assinatura;
try {
  assinatura = assinarManifest(manifest, p12, SENHA, wwdr);
} catch (e) {
  falhar(`Falha ao assinar: ${e.message}`);
}

const msg = forge.pkcs7.messageFromAsn1(forge.asn1.fromDer(assinatura.toString('binary')));
console.log('\n=== assinatura gerada ===');
console.log(`  Tamanho      : ${assinatura.length} bytes`);
console.log(`  Cabeçalho    : ${[...assinatura.slice(0, 4)].map((b) => b.toString(16).padStart(2, '0')).join(' ')}`);
console.log(`  Certificados : ${msg.certificates.length}`);
console.log(`  signerInfos  : ${msg.rawCapture.signerInfos ? msg.rawCapture.signerInfos.length : 0}`);
console.log(`  Destacada    : ${msg.rawCapture.content ? 'NAO' : 'sim'}`);

const ok =
  pareceAssinaturaValida(assinatura) &&
  msg.certificates.length >= 2 &&
  !msg.rawCapture.content &&
  (msg.rawCapture.signerInfos || []).length >= 1;

if (!ok) falhar('A assinatura não tem o formato que o iOS exige.');
console.log('\n✓ Assinatura válida no formato exigido pela Apple.');
