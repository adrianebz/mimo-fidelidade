import assert from 'node:assert';
import { db, ConflictError, GoneError } from '../db/firestore.js';
import { createOrganization } from '../modules/organizations.js';
import { createInviteToken, lookupInvite } from '../modules/invites.js';
import { enrollCustomer } from '../modules/customers.js';
import { getCardState, stampCard } from '../modules/stamps.js';
import { redeemReward } from '../modules/redemptions.js';
import { findCustomerInOrg } from '../modules/reissue.js';
import { getContrastRatio, validateContrast } from '../modules/design.js';

async function runAllTests() {
  console.log('====================================================');
  console.log('🧪 INICIANDO SUÍTE DE TESTES OBRIGATÓRIOS DO MIMO');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  async function runTest(name: string, fn: () => void | Promise<void>) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error('     Erro:', err.message || err);
      if (err.stack) console.error('     Stack:', err.stack);
      failed++;
    }
  }

  // --- TESTE 1: Isolamento entre duas Organizações e Armadilha de Collection Group ---
  await runTest('1. Isolamento Multiempresa: Duas organizações distintas nunca misturam dados', async () => {
    // Org A
    const orgA = createOrganization({
      legalName: 'Padaria Estrela Ltda',
      publicName: 'Padaria Estrela',
      slug: 'padaria-estrela',
      plan: 'starter',
      ownerName: 'Manuel Silva',
      ownerEmail: 'manuel@estrela.com.br',
      rewardLabel: 'Café com Pão de Queijo'
    });

    // Org B
    const orgB = createOrganization({
      legalName: 'Barbearia Vintage Ltda',
      publicName: 'Barbearia Vintage',
      slug: 'barbearia-vintage',
      plan: 'pro',
      ownerName: 'Ricardo Santos',
      ownerEmail: 'ricardo@vintage.com.br',
      rewardLabel: 'Corte Grátis'
    });

    // Invite & Customer in Org A
    const invA = createInviteToken(orgA.org.id, orgA.store.id, orgA.owner.id);
    const cusA = await enrollCustomer(invA.token, {
      firstName: 'Joao',
      lastName: 'Pereira',
      email: 'joao.pereira@gmail.com',
      consent: true
    }, 'http://localhost:3333');

    // Invite & Customer in Org B
    const invB = createInviteToken(orgB.org.id, orgB.store.id, orgB.owner.id);
    const cusB = await enrollCustomer(invB.token, {
      firstName: 'Pedro',
      lastName: 'Alves',
      email: 'pedro.alves@gmail.com',
      consent: true
    }, 'http://localhost:3333');

    // Search inside Org A for Joao -> must find
    const foundInA = findCustomerInOrg(orgA.org.id, 'joao.pereira@gmail.com');
    assert.strictEqual(foundInA.customer.firstName, 'Joao');

    // Search inside Org A for Pedro (from Org B) -> MUST FAIL / NOT FOUND
    assert.throws(() => {
      findCustomerInOrg(orgA.org.id, 'pedro.alves@gmail.com');
    }, (err: any) => err.code === 'CUSTOMER_NOT_FOUND');

    // Collection Group Query test:
    // Without filter, collectionGroup returns stamps from all orgs (the trap!)
    // With filter, returns strictly orgA stamps
    const allStampsUnfiltered = db.collectionGroup('stamps');
    const orgAStampsFiltered = db.collectionGroup('stamps', orgA.org.id);
    const orgBStampsFiltered = db.collectionGroup('stamps', orgB.org.id);

    assert(allStampsUnfiltered.length >= orgAStampsFiltered.length + orgBStampsFiltered.length);
    assert(orgAStampsFiltered.every(s => s.organizationId === orgA.org.id));
    assert(orgBStampsFiltered.every(s => s.organizationId === orgB.org.id));
  });

  // --- TESTE 2: RN14: E-mail único POR ORGANIZAÇÃO ---
  await runTest('2. RN14: Mesmo e-mail pode existir em lojas diferentes, mas não duplicado na mesma loja', async () => {
    const orgA = 'org_padaria-estrela';
    const orgB = 'org_barbearia-vintage';
    const sharedEmail = 'cliente.comum@gmail.com';

    // Enroll in Org A
    const invA = createInviteToken(orgA, 'store_padaria-estrela_01', 'usr_owner');
    await enrollCustomer(invA.token, {
      firstName: 'Cliente',
      lastName: 'Comum',
      email: sharedEmail,
      consent: true
    }, 'http://localhost:3333');

    // Enroll in Org B with same email -> SUCCEEDS (RN14)
    const invB = createInviteToken(orgB, 'store_barbearia-vintage_01', 'usr_owner');
    const resB = await enrollCustomer(invB.token, {
      firstName: 'Cliente',
      lastName: 'Comum',
      email: sharedEmail,
      consent: true
    }, 'http://localhost:3333');
    assert.strictEqual(resB.stamps, 0);

    // Enroll again in Org A with same email -> MUST FAIL WITH EMAIL_ALREADY_EXISTS
    const invA2 = createInviteToken(orgA, 'store_padaria-estrela_01', 'usr_owner');
    await assert.rejects(async () => {
      await enrollCustomer(invA2.token, {
        firstName: 'Tentativa',
        lastName: 'Duplicada',
        email: sharedEmail,
        consent: true
      }, 'http://localhost:3333');
    }, (err: any) => err.code === 'EMAIL_ALREADY_EXISTS');
  });

  // --- TESTE 3: RN3: Idempotência no carimbo ---
  await runTest('3. RN3: Duas chamadas simultâneas com a mesma Idempotency-Key gravam apenas 1 selo', async () => {
    // Maria Silva has 8 stamps initially
    const mariaSerial = '8f3a-92bc-41de-aa22';
    const idemKey = 'test_idem_key_maria_stamp_9';

    // Call 1
    const res1 = await stampCard(mariaSerial, 'usr_clerk_ana', idemKey);
    assert.strictEqual(res1.stamps, 9);
    assert.strictEqual(res1.isIdempotentReplay, false);

    // Call 2 with identical key -> returns saved response, does not increment again
    const res2 = await stampCard(mariaSerial, 'usr_clerk_ana', idemKey);
    assert.strictEqual(res2.stamps, 9);
    assert.strictEqual(res2.isIdempotentReplay, true);

    // Total stamps must remain 9
    const state = getCardState(mariaSerial);
    assert.strictEqual(state.stamps, 9);
  });

  // --- TESTE 4: RN4: Janela antiduplicação de 3 minutos ---
  await runTest('4. RN4: Novo carimbo no mesmo cartão em menos de 3 minutos é bloqueado', async () => {
    const mariaSerial = '8f3a-92bc-41de-aa22';
    const differentKey = 'test_diff_key_immediate_attempt';

    // Must throw STAMP_TOO_SOON
    await assert.rejects(async () => {
      await stampCard(mariaSerial, 'usr_clerk_ana', differentKey);
    }, (err: any) => err.code === 'STAMP_TOO_SOON');
  });

  // --- TESTE 5: RN1 e RN2: 10 selos = Recompensa e Resgate Explícito ---
  await runTest('5. RN1 & RN2: 10º selo libera recompensa; resgate abre novo ciclo e reseta selos', async () => {
    const mariaSerial = '8f3a-92bc-41de-aa22';

    // Fast-forward lastStampAt to bypass 3-minute throttle for test
    const card = db.get(`organizations/org_dessertclub/cards/${mariaSerial}`);
    card.lastStampAt = new Date(Date.now() - 200_000).toISOString();
    db.set(`organizations/org_dessertclub/cards/${mariaSerial}`, card);

    // 10th stamp
    const res10 = await stampCard(mariaSerial, 'usr_clerk_ana', 'key_stamp_10');
    assert.strictEqual(res10.stamps, 10);
    assert.strictEqual(res10.rewardAvailable, true);

    // 11th stamp without redemption -> MUST FAIL (CARD_FULL)
    await assert.rejects(async () => {
      await stampCard(mariaSerial, 'usr_clerk_ana', 'key_stamp_11');
    }, (err: any) => err.code === 'CARD_FULL');

    // Explicit redemption
    const redeemRes = await redeemReward(mariaSerial, 'usr_clerk_ana');
    assert.strictEqual(redeemRes.stamps, 0);
    assert.strictEqual(redeemRes.completedCycle, 1);
    assert.strictEqual(redeemRes.newCycle, 2);

    // Double redemption in same cycle -> MUST FAIL (CARD_NOT_FULL)
    await assert.rejects(async () => {
      await redeemReward(mariaSerial, 'usr_clerk_ana');
    }, (err: any) => err.code === 'CARD_NOT_FULL');
  });

  // --- TESTE 6: Validação de Contraste WCAG 4.5:1 no Construtor de Design ---
  await runTest('6. Construtor de Cartão: Cálculo e validação de contraste WCAG 4.5:1', () => {
    // High contrast: white on graphite #0F0F10
    const check1 = validateContrast({
      backgroundColor: '#0F0F10',
      foregroundColor: '#FFFFFF',
      labelColor: '#8ABABF',
      accentColor: '#FFC82C',
      rewardLabel: 'Cookie',
      stampIcon: 'coin',
      showMimoBranding: true
    });
    assert.strictEqual(check1.isValid, true);
    assert(check1.contrast > 15);

    // Bad contrast: dark gray on black
    const check2 = validateContrast({
      backgroundColor: '#000000',
      foregroundColor: '#222222',
      labelColor: '#333333',
      accentColor: '#FFC82C',
      rewardLabel: 'Cookie',
      stampIcon: 'coin',
      showMimoBranding: true
    });
    assert.strictEqual(check2.isValid, false);
    assert(check2.contrast < 4.5);
  });

  console.log('\n====================================================');
  console.log(`🏁 RESULTADO: ${passed} passaram, ${failed} falharam.`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests();
