/**
 * Assinatura de passes da Apple Wallet.
 *
 * O arquivo `signature` de um .pkpass é uma assinatura PKCS#7 **destacada**
 * (detached) do `manifest.json`, codificada em DER. "Destacada" significa que o
 * conteúdo assinado não vai dentro do envelope — o iOS lê o manifest do próprio
 * pacote e confere contra a assinatura.
 *
 * A cadeia precisa ter dois certificados: o do Pass Type ID (emitido para a sua
 * conta) e o intermediário WWDR da Apple. Sem o WWDR o iOS não consegue
 * encadear até a raiz e recusa o passe sem explicar o motivo.
 */
const forge = require('node-forge');

/** Converte um certificado em DER ou PEM para objeto do forge. */
function lerCertificado(buffer) {
  const texto = buffer.toString('utf8');
  if (texto.includes('-----BEGIN CERTIFICATE-----')) {
    return forge.pki.certificateFromPem(texto);
  }
  // DER: o .cer que a Apple distribui vem assim.
  const asn1 = forge.asn1.fromDer(buffer.toString('binary'));
  return forge.pki.certificateFromAsn1(asn1);
}

/**
 * Extrai certificado e chave privada de um arquivo .p12.
 *
 * O .p12 exportado pelo Keychain traz a chave num "shrouded key bag"
 * (cifrado pela senha); alguns exportadores usam o bag simples. Os dois são
 * tratados para não depender de como o arquivo foi gerado.
 */
function abrirP12(p12Buffer, senha) {
  const asn1 = forge.asn1.fromDer(p12Buffer.toString('binary'));
  const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, senha);

  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [];
  const cifrados = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] || [];
  const simples = p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] || [];
  const keyBags = cifrados.length ? cifrados : simples;

  if (!certBags.length) throw new Error('O .p12 não contém certificado.');
  if (!keyBags.length) throw new Error('O .p12 não contém chave privada. Exporte incluindo a chave.');

  return { certificado: certBags[0].cert, chavePrivada: keyBags[0].key };
}

/**
 * Gera a assinatura PKCS#7 destacada do manifest.
 *
 * @param {Buffer} manifestBuffer  Bytes exatos do manifest.json empacotado.
 * @param {Buffer} p12Buffer       Certificado do Pass Type ID, em .p12.
 * @param {string} senhaP12        Senha usada na exportação do .p12.
 * @param {Buffer} wwdrBuffer      Intermediário WWDR da Apple (.cer ou .pem).
 * @returns {Buffer}               DER do envelope, pronto para virar `signature`.
 */
function assinarManifest(manifestBuffer, p12Buffer, senhaP12, wwdrBuffer) {
  const { certificado, chavePrivada } = abrirP12(p12Buffer, senhaP12);
  const wwdr = lerCertificado(wwdrBuffer);

  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(manifestBuffer.toString('binary'));
  p7.addCertificate(certificado);
  p7.addCertificate(wwdr);
  p7.addSigner({
    key: chavePrivada,
    certificate: certificado,
    digestAlgorithm: forge.pki.oids.sha256,
    // Sem estes atributos autenticados o iOS rejeita a assinatura.
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date() },
    ],
  });

  p7.sign({ detached: true });
  return Buffer.from(forge.asn1.toDer(p7.toAsn1()).getBytes(), 'binary');
}

/**
 * Confere se um buffer tem a cara de um PKCS#7 em DER.
 *
 * Serve de salvaguarda barata contra o erro que já existiu aqui: gravar um
 * hash cru no lugar da assinatura. Um DER válido começa com SEQUENCE (0x30).
 */
function pareceAssinaturaValida(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 256) return false;
  if (buffer[0] !== 0x30) return false;
  try {
    const p7 = forge.pkcs7.messageFromAsn1(forge.asn1.fromDer(buffer.toString('binary')));
    return Array.isArray(p7.certificates) && p7.certificates.length >= 1;
  } catch {
    return false;
  }
}

module.exports = { assinarManifest, pareceAssinaturaValida, abrirP12, lerCertificado };
