import { v4 as uuidv4 } from 'uuid';
import { db, ConflictError, NotFoundError } from '../db/firestore.js';
import { Card, Stamp, Store } from '../types/index.js';

export function getCardState(serial: string) {
  const index = db.get(`cards_by_serial/${serial}`);
  if (!index) {
    throw new NotFoundError('CARD_NOT_FOUND', 'Cartão não encontrado.');
  }

  const { organizationId, storeId } = index;
  const card: Card = db.get(`organizations/${organizationId}/cards/${serial}`);
  if (!card) {
    throw new NotFoundError('CARD_NOT_FOUND', 'Cartão não encontrado.');
  }

  const store: Store = db.get(`organizations/${organizationId}/stores/${storeId}`) || {
    stampsRequired: 10,
    rewardLabel: 'Cookie Grátis'
  };

  const now = Date.now();
  const lastStampTime = card.lastStampAt ? new Date(card.lastStampAt).getTime() : 0;
  const diffMs = now - lastStampTime;
  const isTooSoon = card.lastStampAt ? diffMs < 180_000 : false;
  const isFull = card.stampsCount >= (store.stampsRequired || 10);

  let blockedReason: string | null = null;
  let secondsRemaining = 0;

  if (isFull) {
    blockedReason = 'CARD_FULL';
  } else if (isTooSoon) {
    blockedReason = 'STAMP_TOO_SOON';
    secondsRemaining = Math.ceil((180_000 - diffMs) / 1000);
  }

  return {
    serial: card.serial,
    organizationId,
    storeId,
    customer: {
      name: card.customerName,
      email_masked: card.customerEmailMasked
    },
    stamps: card.stampsCount,
    required: store.stampsRequired || 10,
    cycle: card.cycle,
    reward_label: store.rewardLabel,
    reward_available: isFull,
    last_stamp_at: card.lastStampAt,
    can_stamp: !isFull && !isTooSoon,
    blocked_reason: blockedReason,
    seconds_remaining: secondsRemaining
  };
}

export async function stampCard(
  serial: string,
  staffId: string,
  idempotencyKey: string
) {
  const index = db.get(`cards_by_serial/${serial}`);
  if (!index) {
    throw new NotFoundError('CARD_NOT_FOUND', 'Cartão não encontrado.');
  }

  const { organizationId, storeId } = index;

  return await db.runTransaction(async (tx) => {
    // 1. Idempotency replay check
    const idemPath = `idempotency/${idempotencyKey}`;
    const idemDoc = tx.get(idemPath);
    if (idemDoc.exists) {
      return {
        ...idemDoc.data().response,
        isIdempotentReplay: true
      };
    }

    // 2. Lock and retrieve card
    const cardPath = `organizations/${organizationId}/cards/${serial}`;
    const cardDoc = tx.get(cardPath);
    if (!cardDoc.exists) {
      throw new NotFoundError('CARD_NOT_FOUND', 'Cartão não encontrado.');
    }
    const card: Card = cardDoc.data();

    // 3. Business rule RN1: Max 10 stamps per cycle
    if (card.stampsCount >= 10) {
      throw new ConflictError('CARD_FULL', 'Cartão já atingiu o limite de 10 selos. Resgate a recompensa para abrir novo ciclo.');
    }

    // 4. Business rule RN4: Anti-fraud throttle of 3 minutes (180,000 ms)
    const now = Date.now();
    if (card.lastStampAt) {
      const lastTime = new Date(card.lastStampAt).getTime();
      const diffMs = now - lastTime;
      if (diffMs < 180_000) {
        const remainingSec = Math.ceil((180_000 - diffMs) / 1000);
        throw new ConflictError('STAMP_TOO_SOON', `Selo já registrado recentemente. Aguarde ${remainingSec}s para um novo carimbo.`);
      }
    }

    const nowIso = new Date(now).toISOString();
    const newStampsCount = card.stampsCount + 1;
    const stampId = `stamp_${uuidv4().replace(/-/g, '').substring(0, 16)}`;

    // 5. Create immutable Stamp record
    const stamp: Stamp = {
      id: stampId,
      organizationId,
      storeId,
      cardId: serial,
      staffId,
      cycle: card.cycle,
      source: 'staff_scan',
      createdAt: nowIso
    };
    tx.create(`organizations/${organizationId}/stamps/${stampId}`, stamp);

    // 6. Update Card atomically
    tx.update(cardPath, {
      stampsCount: newStampsCount,
      lastStampAt: nowIso,
      updatedAt: nowIso
    });

    // 7. Update counters
    const counterPath = `organizations/${organizationId}/counters/totals`;
    const counterDoc = tx.get(counterPath);
    if (counterDoc.exists) {
      const c = counterDoc.data();
      tx.update(counterPath, {
        totals: {
          ...c.totals,
          stampsAllTime: (c.totals?.stampsAllTime || 0) + 1
        }
      });
    }

    const response = {
      serial: card.serial,
      customerName: card.customerName,
      stamps: newStampsCount,
      required: 10,
      cycle: card.cycle,
      rewardAvailable: newStampsCount >= 10,
      stampedAt: nowIso,
      isIdempotentReplay: false
    };

    // 8. Store idempotency response with 24h expiration
    tx.create(idemPath, {
      key: idempotencyKey,
      organizationId,
      cardId: serial,
      response,
      createdAt: nowIso,
      expiresAt: new Date(now + 24 * 60 * 60 * 1000).toISOString()
    });

    return response;
  });
}
