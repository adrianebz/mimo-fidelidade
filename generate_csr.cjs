const forge = require('node-forge');
const fs = require('fs');

console.log('Gerando chave privada (isso pode levar alguns segundos)...');
forge.pki.rsa.generateKeyPair({ bits: 2048 }, function (err, keypair) {
  if (err) {
    console.error('Erro ao gerar chave:', err);
    return;
  }

  // Save private key
  const privateKeyPem = forge.pki.privateKeyToPem(keypair.privateKey);
  fs.writeFileSync('pass.key', privateKeyPem);
  console.log('✔ Chave privada gerada e salva como "pass.key"');

  // Create CSR
  console.log('Criando Certificate Signing Request (CSR)...');
  const csr = forge.pki.createCertificationRequest();
  csr.publicKey = keypair.publicKey;

  csr.setSubject([
    { name: 'commonName', value: 'Boomii Fidelidade' },
    { name: 'countryName', value: 'BR' },
    { name: 'organizationName', value: 'Boomii' },
    { name: 'emailAddress', value: 'contato@boomii.com.br' }
  ]);

  // Sign CSR with the private key
  csr.sign(keypair.privateKey, forge.md.sha256.create());

  // Save CSR
  const csrPem = forge.pki.certificationRequestToPem(csr);
  fs.writeFileSync('pass.csr', csrPem);
  console.log('✔ CSR gerado e salvo como "pass.csr"');
  console.log('\n========================================================');
  console.log('Tudo pronto! Faça o upload do arquivo "pass.csr" no portal da Apple.');
  console.log('O arquivo está na pasta raiz do projeto.');
});
