import { v4 as uuidv4 } from 'uuid';
import { db, NotFoundError } from '../db/firestore.js';
import { Card, Customer, Organization, Store } from '../types/index.js';
import { generateGoogleWalletSaveUrl } from '../wallet/google/save-link.js';
import { getActiveDesign } from './design.js';

export function findCustomerInOrg(orgId: string, query: string): { customer: Customer; card: Card } {
  const cleanQuery = query.trim().toLowerCase();

  // Search by exact email first
  const emailUnique = db.get(`organizations/${orgId}/uniques/email_${cleanQuery}`);
  let customerId = emailUnique?.customerId;

  if (!customerId) {
    // Search customers in org by partial email or name
    const customers = db.listPrefix(`organizations/${orgId}/customers/`);
    const found = customers.find(c =>
      c.data.emailLower.includes(cleanQuery) ||
      `${c.data.firstName} ${c.data.lastName}`.toLowerCase().includes(cleanQuery)
    );
    if (found) {
      customerId = found.data.id;
    }
  }

  if (!customerId) {
    throw new NotFoundError('CUSTOMER_NOT_FOUND', 'Cliente não encontrado nesta organização.');
  }

  const customer: Customer = db.get(`organizations/${orgId}/customers/${customerId}`);
  const card: Card = db.get(`organizations/${orgId}/cards/${customer.cardId}`);

  return { customer, card };
}

export function createReissueLink(orgId: string, cardSerial: string, baseUrl: string) {
  const card: Card = db.get(`organizations/${orgId}/cards/${cardSerial}`);
  if (!card) {
    throw new NotFoundError('CARD_NOT_FOUND', 'Cartão não encontrado.');
  }

  const org: Organization = db.get(`organizations/${orgId}`);
  const design = getActiveDesign(orgId);

  const token = `reissue_${uuidv4().replace(/-/g, '').substring(0, 16)}`;
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 minutes

  db.set(`reissueTokens/${token}`, {
    token,
    organizationId: orgId,
    cardSerial,
    expiresAt,
    createdAt: new Date().toISOString()
  });

  const applePassUrl = `${baseUrl}/api/passes/apple/${card.serial}`;
  const googleSaveUrl = generateGoogleWalletSaveUrl(card, org, design.config, baseUrl);

  return {
    reissueToken: token,
    reissueUrl: `${baseUrl}/reemitir/${token}`,
    cardSerial: card.serial,
    customerName: card.customerName,
    stamps: card.stampsCount,
    cycle: card.cycle,
    applePassUrl,
    googleSaveUrl,
    expiresAt
  };
}
