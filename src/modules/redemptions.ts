import { db, ConflictError, NotFoundError } from '../db/firestore.js';
import { Card, Redemption, Store } from '../types/index.js';

export async function redeemReward(serial: string, staffId: string) {
  const index = db.get(`cards_by_serial/${serial}`);
  if (!index) {
    throw new NotFoundError('CARD_NOT_FOUND', 'Cartão não encontrado.');
  }

  const { organizationId, storeId } = index;

  return await db.runTransaction(async (tx) => {
    const cardPath = `organizations/${organizationId}/cards/${serial}`;
    const cardDoc = tx.get(cardPath);
    if (!cardDoc.exists) {
      throw new NotFoundError('CARD_NOT_FOUND', 'Cartão não encontrado.');
    }
    const card: Card = cardDoc.data();

    // Must have completed 10 stamps
    if (card.stampsCount < 10) {
      throw new ConflictError('CARD_NOT_FULL', `Cartão possui ${card.stampsCount}/10 selos. Resgate só é permitido com 10 selos completos.`);
    }

    const store: Store = db.get(`organizations/${organizationId}/stores/${storeId}`) || {
      rewardLabel: 'Cookie Grátis'
    };

    // Deterministic key: {cardId}_{cycle}
    const redemptionId = `${serial}_${card.cycle}`;
    const redemptionPath = `organizations/${organizationId}/redemptions/${redemptionId}`;
    const redDoc = tx.get(redemptionPath);
    if (redDoc.exists) {
      throw new ConflictError('REDEMPTION_ALREADY_EXISTS', 'A recompensa deste ciclo já foi resgatada.');
    }

    const nowIso = new Date().toISOString();
    const redemption: Redemption = {
      id: redemptionId,
      organizationId,
      storeId,
      cardId: serial,
      staffId,
      cycle: card.cycle,
      rewardLabel: store.rewardLabel || 'Recompensa do Programa',
      createdAt: nowIso
    };

    // 1. Create redemption record
    tx.create(redemptionPath, redemption);

    // 2. Advance card cycle and reset stamps to 0
    const newCycle = card.cycle + 1;
    tx.update(cardPath, {
      stampsCount: 0,
      cycle: newCycle,
      updatedAt: nowIso
    });

    // 3. Update counters
    const counterPath = `organizations/${organizationId}/counters/totals`;
    const counterDoc = tx.get(counterPath);
    if (counterDoc.exists) {
      const c = counterDoc.data();
      tx.update(counterPath, {
        totals: {
          ...c.totals,
          redemptionsAllTime: (c.totals?.redemptionsAllTime || 0) + 1
        }
      });
    }

    return {
      serial: card.serial,
      customerName: card.customerName,
      rewardRedeemed: redemption.rewardLabel,
      completedCycle: card.cycle,
      newCycle,
      stamps: 0,
      redeemedAt: nowIso
    };
  });
}
