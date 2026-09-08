import { v4 as uuidv4 } from 'uuid';
import { db, ConflictError, NotFoundError } from '../db/firestore.js';
import { CardDesign, Member, OrgCounters, Organization, Store } from '../types/index.js';

export function createOrganization(input: {
  legalName: string;
  publicName: string;
  slug: string;
  plan: 'starter' | 'pro' | 'unlimited';
  ownerName: string;
  ownerEmail: string;
  rewardLabel?: string;
}) {
  const orgId = `org_${input.slug.replace(/[^a-z0-9_-]/gi, '').toLowerCase()}`;
  if (db.get(`organizations/${orgId}`)) {
    throw new ConflictError('ORG_SLUG_EXISTS', 'Já existe uma organização com esse slug/identificador.');
  }

  const now = new Date().toISOString();
  const storeId = `store_${input.slug}_01`;
  const ownerId = `usr_${uuidv4().replace(/-/g, '').substring(0, 12)}`;

  const org: Organization = {
    id: orgId,
    legalName: input.legalName,
    publicName: input.publicName,
    slug: input.slug,
    plan: input.plan,
    active: true,
    createdAt: now,
    updatedAt: now
  };

  const store: Store = {
    id: storeId,
    organizationId: orgId,
    name: `${input.publicName} — Matriz`,
    slug: 'matriz',
    timezone: 'America/Sao_Paulo',
    stampsRequired: 10,
    rewardLabel: input.rewardLabel || 'Recompensa Exclusiva',
    activeDesignVersion: 1,
    createdAt: now
  };

  const owner: Member = {
    id: ownerId,
    organizationId: orgId,
    storeIds: [storeId],
    name: input.ownerName,
    email: input.ownerEmail.toLowerCase().trim(),
    role: 'owner',
    active: true,
    createdAt: now
  };

  const defaultDesign: CardDesign = {
    version: 1,
    organizationId: orgId,
    storeId,
    config: {
      backgroundColor: '#0F0F10',
      foregroundColor: '#FFFFFF',
      labelColor: '#8ABABF',
      accentColor: '#FFC82C',
      rewardLabel: store.rewardLabel,
      stampIcon: 'coin',
      showMimoBranding: true
    },
    status: 'published',
    publishedAt: now,
    publishedBy: ownerId,
    createdAt: now
  };

  const counters: OrgCounters = {
    totals: { customers: 0, cardsActive: 0, stampsAllTime: 0, redemptionsAllTime: 0 },
    daily: {}
  };

  db.set(`organizations/${orgId}`, org);
  db.set(`organizations/${orgId}/stores/${storeId}`, store);
  db.set(`organizations/${orgId}/members/${ownerId}`, owner);
  db.set(`organizations/${orgId}/designs/1`, defaultDesign);
  db.set(`organizations/${orgId}/counters/totals`, counters);

  return { org, store, owner };
}

export function listAllOrganizations(): Organization[] {
  const orgs = db.listPrefix('organizations/');
  const result: Organization[] = [];
  for (const item of orgs) {
    const parts = item.path.split('/');
    if (parts.length === 2) {
      result.push(item.data);
    }
  }
  return result;
}

export function getOrganizationDetails(orgId: string) {
  const org: Organization = db.get(`organizations/${orgId}`);
  if (!org) {
    throw new NotFoundError('ORG_NOT_FOUND', 'Organização não encontrada.');
  }

  const stores = db.listPrefix(`organizations/${orgId}/stores/`).map(s => s.data);
  const members = db.listPrefix(`organizations/${orgId}/members/`).map(m => m.data);
  const counters = db.get(`organizations/${orgId}/counters/totals`) || {
    totals: { customers: 0, cardsActive: 0, stampsAllTime: 0, redemptionsAllTime: 0 }
  };

  return {
    org,
    stores,
    members,
    counters: counters.totals
  };
}

export function exportOrganizationCsv(orgId: string): string {
  const customers = db.listPrefix(`organizations/${orgId}/customers/`).map(c => c.data);
  const cards = db.listPrefix(`organizations/${orgId}/cards/`).map(c => c.data);

  const cardMap = new Map<string, any>();
  for (const card of cards) {
    cardMap.set(card.customerId, card);
  }

  const rows: string[] = [];
  rows.push('Cliente_ID,Nome,Sobrenome,Email,Telefone,Data_Nascimento,Selos_Atuais,Ciclo_Atual,Serial_Cartao,Data_Cadastro');

  for (const cus of customers) {
    const card = cardMap.get(cus.id);
    const stamps = card ? card.stampsCount : 0;
    const cycle = card ? card.cycle : 1;
    const serial = card ? card.serial : '';

    rows.push([
      cus.id,
      `"${cus.firstName}"`,
      `"${cus.lastName}"`,
      cus.email,
      cus.phoneE164 || '',
      cus.birthDate || '',
      stamps,
      cycle,
      serial,
      cus.createdAt
    ].join(','));
  }

  return rows.join('\n');
}
