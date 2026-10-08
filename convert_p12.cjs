const fs = require('fs');
const forge = require('node-forge');

function derToPem(derBuffer) {
  const derStr = forge.util.createBuffer(derBuffer.toString('binary'));
  const asn1 = forge.asn1.fromDer(derStr);
  const cert = forge.pki.certificateFromAsn1(asn1);
  return forge.pki.certificateToPem(cert);
}

try {
  console.log('Lendo pass.cer...');
  const passCerBuffer = fs.readFileSync('pass.cer');
  const passPem = derToPem(passCerBuffer);
  fs.writeFileSync('pass.pem', passPem);
  console.log('✔ pass.pem gerado');

  console.log('Lendo AppleWWDRCAG4.cer...');
  const wwdrCerBuffer = fs.readFileSync('AppleWWDRCAG4.cer');
  const wwdrPem = derToPem(wwdrCerBuffer);
  fs.writeFileSync('wwdr.pem', wwdrPem);
  console.log('✔ wwdr.pem gerado');

  console.log('Criando pass.p12...');
  const privateKeyPem = fs.readFileSync('pass.key', 'utf8');
  const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);
  const cert = forge.pki.certificateFromPem(passPem);
  
  // Package to p12
  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(privateKey, [cert], 'boomii2026', {generateLocalKeyId: true, friendlyName: 'Boomii Pass Key'});
  const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
  fs.writeFileSync('pass.p12', Buffer.from(p12Der, 'binary'));
  console.log('✔ pass.p12 gerado com sucesso! (Senha definida como: boomii2026)');
  console.log('\nTudo concluído!');
} catch(err) {
  console.error('Erro na conversão:', err);
}
