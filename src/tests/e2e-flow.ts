import assert from 'node:assert';

async function runE2E() {
  console.log('🚀 Executando teste End-to-End no servidor HTTP ao vivo (http://localhost:3333)...\n');

  // 1. Health check
  const healthRes = await fetch('http://localhost:3333/api/health');
  assert.strictEqual(healthRes.status, 200);
  const healthData = await healthRes.json();
  console.log('1. Health check OK:', healthData);

  // 2. Balconista emite convite QR (15 min)
  const inviteRes = await fetch('http://localhost:3333/api/invites', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ organizationId: 'org_dessertclub', storeId: 'store_dessertclub_sp' })
  });
  assert.strictEqual(inviteRes.status, 201);
  const invite = await inviteRes.json();
  console.log('2. Convite QR emitido:', invite.token, 'expira em:', invite.expires_at);

  // 3. Consumidor valida convite
  const enrollLookupRes = await fetch(`http://localhost:3333/api/enroll/${invite.token}`);
  assert.strictEqual(enrollLookupRes.status, 200);
  const lookupData = await enrollLookupRes.json();
  assert.strictEqual(lookupData.store_name, 'Dessert Club');
  console.log('3. Validação do convite OK para loja:', lookupData.store_name);

  // 4. Consumidor se cadastra pelo celular (≤ 90s)
  const enrollSubmitRes = await fetch(`http://localhost:3333/api/enroll/${invite.token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      firstName: 'Lucas',
      lastName: 'Ferreira',
      email: 'lucas.ferreira@teste.com',
      phone: '+5511999998888',
      consent: true
    })
  });
  assert.strictEqual(enrollSubmitRes.status, 201);
  const newCard = await enrollSubmitRes.json();
  console.log('4. Cartão criado para Lucas Ferreira! Serial:', newCard.cardSerial);
  console.log('   Botão Apple Wallet URL:', newCard.applePassUrl);
  console.log('   Botão Google Wallet URL:', newCard.googleSaveUrl.substring(0, 60) + '...');

  // 5. Consulta do cartão no leitor do balcão (≤ 2s)
  const cardLookupRes = await fetch(`http://localhost:3333/api/cards/${newCard.cardSerial}`);
  assert.strictEqual(cardLookupRes.status, 200);
  const cardState = await cardLookupRes.json();
  assert.strictEqual(cardState.customer.name, 'Lucas Ferreira');
  assert.strictEqual(cardState.stamps, 0);
  console.log('5. Leitura do balcão OK: Nome conferido:', cardState.customer.name, 'Saldo:', cardState.stamps);

  // 6. Carimbo no balcão (+1 selo) com medição de tempo
  const t0 = performance.now();
  const stampRes = await fetch(`http://localhost:3333/api/cards/${newCard.cardSerial}/stamp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': `e2e_idem_${Date.now()}`
    },
    body: JSON.stringify({ staffId: 'usr_clerk_ana' })
  });
  const elapsed = performance.now() - t0;
  assert.strictEqual(stampRes.status, 200);
  const stampedData = await stampRes.json();
  assert.strictEqual(stampedData.stamps, 1);
  console.log(`6. Selo registrado com sucesso em ${elapsed.toFixed(1)}ms! Novo saldo: ${stampedData.stamps}/10`);

  // 7. Tentativa imediata de segundo carimbo (verificando bloqueio de 3 min)
  const secondStampRes = await fetch(`http://localhost:3333/api/cards/${newCard.cardSerial}/stamp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': `e2e_idem_immediate`
    },
    body: JSON.stringify({ staffId: 'usr_clerk_ana' })
  });
  assert.strictEqual(secondStampRes.status, 409);
  const secondErr = await secondStampRes.json();
  console.log('7. Bloqueio de 3 min (RN4) verificado:', secondErr.error.code, '-', secondErr.error.message);

  // 8. Download de .pkpass da Apple Wallet
  const pkpassRes = await fetch(`http://localhost:3333/api/passes/apple/${newCard.cardSerial}`);
  assert.strictEqual(pkpassRes.status, 200);
  assert.strictEqual(pkpassRes.headers.get('content-type'), 'application/vnd.apple.pkpass');
  console.log('8. Download do .pkpass da Apple Wallet OK (Content-Type:', pkpassRes.headers.get('content-type'), ')');

  // 9. Reemissão de cartão por perda de aparelho (preserva saldo e serial)
  const reissueRes = await fetch('http://localhost:3333/api/cards/reissue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orgId: 'org_dessertclub', cardSerial: newCard.cardSerial })
  });
  assert.strictEqual(reissueRes.status, 200);
  const reissueData = await reissueRes.json();
  assert.strictEqual(reissueData.cardSerial, newCard.cardSerial);
  assert.strictEqual(reissueData.stamps, 1);
  console.log('9. Reemissão de cartão OK! Serial preservado:', reissueData.cardSerial, 'Saldo preservado:', reissueData.stamps);

  // 10. Construtor de Cartão & Verificação de Contraste WCAG
  const designRes = await fetch('http://localhost:3333/api/design/org_dessertclub');
  assert.strictEqual(designRes.status, 200);
  const designData = await designRes.json();
  assert.strictEqual(designData.contrast.isValid, true);
  console.log('10. Construtor de Cartão OK! Contraste:', designData.contrast.contrast, ': 1 (Aprovado WCAG)');

  console.log('\n🎉 TODOS OS 10 PASSOS END-TO-END NO SERVIDOR AO VIVO FORAM CONCLUÍDOS COM SUCESSO!');
}

runE2E();
