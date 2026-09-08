// Mock Data Service — Provides demo data for the MIMO platform
// Eliminates API call errors when running on Firebase Hosting without backend

export interface CardData {
  serial: string;
  customer: {
    name: string;
    email_masked: string;
    email: string;
  };
  stamps: number;
  required: number;
  cycle: number;
  reward_label: string;
  reward_available: boolean;
  can_stamp: boolean;
  blocked_reason: string | null;
  seconds_remaining: number;
}

export interface InviteData {
  token: string;
  qr_payload: string;
  expires_at: string;
}

export interface OrgStats {
  org: {
    id: string;
    publicName: string;
    legalName: string;
    plan: string;
  };
  stores: Array<{
    id: string;
    name: string;
    activeDesignVersion: number;
  }>;
  counters: {
    customers: number;
    stampsAllTime: number;
    redemptionsAllTime: number;
  };
}

export interface Organization {
  id: string;
  publicName: string;
  legalName: string;
  slug: string;
  plan: string;
  status: string;
  createdAt: string;
}

// ── Demo card database (in-memory) ──────────────────────────────
const demoCards: Record<string, CardData> = {
  '8f3a-92bc-41de-aa22': {
    serial: '8f3a-92bc-41de-aa22',
    customer: {
      name: 'Maria Silva',
      email_masked: 'm***a@exemplo.com',
      email: 'maria@exemplo.com',
    },
    stamps: 8,
    required: 10,
    cycle: 1,
    reward_label: 'Cookie Grátis',
    reward_available: false,
    can_stamp: true,
    blocked_reason: null,
    seconds_remaining: 0,
  },
  'b2c4-11ef-99ab-de34': {
    serial: 'b2c4-11ef-99ab-de34',
    customer: {
      name: 'João Santos',
      email_masked: 'j***o@exemplo.com',
      email: 'joao@exemplo.com',
    },
    stamps: 3,
    required: 10,
    cycle: 1,
    reward_label: 'Cookie Grátis',
    reward_available: false,
    can_stamp: true,
    blocked_reason: null,
    seconds_remaining: 0,
  },
  'f7e1-45cd-8a32-bc56': {
    serial: 'f7e1-45cd-8a32-bc56',
    customer: {
      name: 'Ana Costa',
      email_masked: 'a***a@exemplo.com',
      email: 'ana@exemplo.com',
    },
    stamps: 10,
    required: 10,
    cycle: 2,
    reward_label: 'Cookie Grátis',
    reward_available: true,
    can_stamp: false,
    blocked_reason: null,
    seconds_remaining: 0,
  },
};

export interface CustomerRecord {
  id: string;
  serial: string;
  name: string;
  email: string;
  phone: string;
  stamps: number;
  cycle: number;
  cohort: 'habitual' | 'recorrente' | 'novo' | 'ausente' | 'perdido';
  lastVisit: string;
  createdAt: string;
  totalVisits: number;
  rewardAvailable: boolean;
}

export const demoCustomers: CustomerRecord[] = [
  {
    id: 'c1',
    serial: '8f3a-92bc-41de-aa22',
    name: 'Maria Silva',
    email: 'm***a@exemplo.com',
    phone: '(11) 98765-4321',
    stamps: 8,
    cycle: 1,
    cohort: 'habitual',
    lastVisit: 'Hoje, 14:32',
    createdAt: '12/07/2026',
    totalVisits: 8,
    rewardAvailable: false,
  },
  {
    id: 'c2',
    serial: 'b2c4-11ef-99ab-de34',
    name: 'João Santos',
    email: 'j***o@exemplo.com',
    phone: '(11) 97654-3210',
    stamps: 3,
    cycle: 1,
    cohort: 'novo',
    lastVisit: 'Ontem, 16:15',
    createdAt: '02/09/2026',
    totalVisits: 3,
    rewardAvailable: false,
  },
  {
    id: 'c3',
    serial: 'f7e1-45cd-8a32-bc56',
    name: 'Ana Costa',
    email: 'a***a@exemplo.com',
    phone: '(21) 99876-5432',
    stamps: 10,
    cycle: 2,
    cohort: 'habitual',
    lastVisit: 'Há 2 dias',
    createdAt: '15/06/2026',
    totalVisits: 20,
    rewardAvailable: true,
  },
  {
    id: 'c4',
    serial: '4a1b-88cd-e567-ff12',
    name: 'Lucas Ferreira',
    email: 'l***s@exemplo.com',
    phone: '(11) 96543-2109',
    stamps: 1,
    cycle: 1,
    cohort: 'novo',
    lastVisit: 'Há 3 dias',
    createdAt: '04/09/2026',
    totalVisits: 1,
    rewardAvailable: false,
  },
  {
    id: 'c5',
    serial: '9d2e-33ff-aa45-bb67',
    name: 'Camila Albuquerque',
    email: 'c***a@exemplo.com',
    phone: '(31) 98877-6655',
    stamps: 6,
    cycle: 1,
    cohort: 'novo',
    lastVisit: 'Há 5 dias',
    createdAt: '01/09/2026',
    totalVisits: 6,
    rewardAvailable: false,
  },
  {
    id: 'c6',
    serial: '1e3f-55aa-77bb-99cc',
    name: 'Rodrigo Lima',
    email: 'r***o@exemplo.com',
    phone: '(11) 95544-3322',
    stamps: 4,
    cycle: 1,
    cohort: 'novo',
    lastVisit: 'Há 6 dias',
    createdAt: '30/08/2026',
    totalVisits: 4,
    rewardAvailable: false,
  },
  {
    id: 'c7',
    serial: '3b4c-66dd-88ee-0011',
    name: 'Beatriz Martins',
    email: 'b***z@exemplo.com',
    phone: '(19) 97788-9900',
    stamps: 2,
    cycle: 1,
    cohort: 'novo',
    lastVisit: 'Há 8 dias',
    createdAt: '29/08/2026',
    totalVisits: 2,
    rewardAvailable: false,
  },
  {
    id: 'c8',
    serial: '5c6d-77ee-99ff-1122',
    name: 'Gabriel Souza',
    email: 'g***l@exemplo.com',
    phone: '(11) 94433-2211',
    stamps: 5,
    cycle: 1,
    cohort: 'novo',
    lastVisit: 'Há 10 dias',
    createdAt: '27/08/2026',
    totalVisits: 5,
    rewardAvailable: false,
  },
  {
    id: 'c9',
    serial: '7d8e-99ff-11aa-3344',
    name: 'Juliana Paiva',
    email: 'j***a@exemplo.com',
    phone: '(11) 93322-1100',
    stamps: 7,
    cycle: 1,
    cohort: 'ausente',
    lastVisit: 'Há 18 dias',
    createdAt: '05/08/2026',
    totalVisits: 7,
    rewardAvailable: false,
  },
  {
    id: 'c10',
    serial: '8e9f-00aa-22bb-4455',
    name: 'Felipe Rocha',
    email: 'f***e@exemplo.com',
    phone: '(21) 96655-4433',
    stamps: 4,
    cycle: 1,
    cohort: 'ausente',
    lastVisit: 'Há 22 dias',
    createdAt: '20/07/2026',
    totalVisits: 4,
    rewardAvailable: false,
  },
  {
    id: 'c11',
    serial: '9f0a-11bb-33cc-5566',
    name: 'Fernanda Meireles',
    email: 'f***a@exemplo.com',
    phone: '(11) 92211-0099',
    stamps: 9,
    cycle: 1,
    cohort: 'perdido',
    lastVisit: 'Há 35 dias',
    createdAt: '10/06/2026',
    totalVisits: 9,
    rewardAvailable: false,
  },
  {
    id: 'c12',
    serial: '0a1b-22cc-44dd-6677',
    name: 'Marcos Vinicius',
    email: 'm***s@exemplo.com',
    phone: '(41) 98899-0011',
    stamps: 2,
    cycle: 1,
    cohort: 'perdido',
    lastVisit: 'Há 45 dias',
    createdAt: '01/05/2026',
    totalVisits: 2,
    rewardAvailable: false,
  },
];

const demoOrgs: Organization[] = [
  {
    id: 'org_dessertclub',
    publicName: 'Dessert Club',
    legalName: 'Dessert Club Alimentos Ltda',
    slug: 'dessert-club',
    plan: 'pro',
    status: 'active',
    createdAt: '2026-08-15T10:00:00Z',
  },
  {
    id: 'org_cafebelvista',
    publicName: 'Café Bela Vista',
    legalName: 'Bela Vista Café e Brunch Ltda',
    slug: 'cafe-bela-vista',
    plan: 'starter',
    status: 'active',
    createdAt: '2026-09-01T14:30:00Z',
  },
];

// ── Service methods ────────────────────────────────────────────

/** Simulate latency */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** Fetch card data by serial */
export async function fetchCard(serial: string): Promise<CardData> {
  await delay(200 + Math.random() * 300);
  const card = demoCards[serial.trim()];
  if (!card) {
    throw new Error('Cartão não encontrado. Verifique o serial informado.');
  }
  return { ...card };
}

/** Stamp a card (+1 selo) */
export async function stampCard(serial: string): Promise<{
  stamps: number;
  reward_available: boolean;
  elapsed: string;
}> {
  await delay(150 + Math.random() * 250);
  const card = demoCards[serial];
  if (!card) throw new Error('Cartão não encontrado.');
  if (!card.can_stamp) throw new Error('Não é possível carimbar agora.');

  card.stamps = Math.min(card.stamps + 1, 10);
  card.reward_available = card.stamps >= 10;
  card.can_stamp = card.stamps < 10;

  // Simulate 3-min anti-fraud cooldown
  if (card.stamps < 10) {
    card.blocked_reason = 'STAMP_TOO_SOON';
    card.seconds_remaining = 180;
    card.can_stamp = false;
    setTimeout(() => {
      card.blocked_reason = null;
      card.seconds_remaining = 0;
      card.can_stamp = true;
    }, 5000); // Demo: unlock after 5s instead of 3min
  }

  return {
    stamps: card.stamps,
    reward_available: card.reward_available,
    elapsed: (0.3 + Math.random() * 0.5).toFixed(2),
  };
}

/** Redeem reward */
export async function redeemReward(serial: string): Promise<{
  rewardRedeemed: string;
  newCycle: number;
}> {
  await delay(300);
  const card = demoCards[serial];
  if (!card) throw new Error('Cartão não encontrado.');
  if (!card.reward_available) throw new Error('Nenhuma recompensa disponível.');

  const rewardRedeemed = card.reward_label;
  card.stamps = 0;
  card.cycle += 1;
  card.reward_available = false;
  card.can_stamp = true;
  card.blocked_reason = null;
  card.seconds_remaining = 0;

  return { rewardRedeemed, newCycle: card.cycle };
}

/** Generate a demo invite */
export async function generateInvite(): Promise<InviteData> {
  await delay(200);
  const token = `inv_demo_${Date.now().toString(36)}`;
  return {
    token,
    qr_payload: `https://mimo-fidelidade.web.app/entrar/${token}`,
    expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  };
}

/** Enroll a new customer (demo) */
export async function enrollCustomer(data: {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
}): Promise<{
  cardSerial: string;
  customerName: string;
  storeName: string;
  rewardLabel: string;
  applePassUrl: string;
  googleSaveUrl: string;
}> {
  await delay(500);
  const serial = `${Math.random().toString(16).slice(2, 6)}-${Math.random().toString(16).slice(2, 6)}-${Math.random().toString(16).slice(2, 6)}-${Math.random().toString(16).slice(2, 6)}`;
  const fullName = `${data.firstName} ${data.lastName}`;

  // Add to demo cards
  demoCards[serial] = {
    serial,
    customer: {
      name: fullName,
      email_masked: data.email.replace(/(.{2}).*(@.*)/, '$1***$2'),
      email: data.email,
    },
    stamps: 0,
    required: 10,
    cycle: 1,
    reward_label: 'Cookie Grátis',
    reward_available: false,
    can_stamp: true,
    blocked_reason: null,
    seconds_remaining: 0,
  };

  return {
    cardSerial: serial,
    customerName: fullName,
    storeName: 'Dessert Club',
    rewardLabel: 'Cookie Grátis',
    applePassUrl: `#apple-pass-${serial}`,
    googleSaveUrl: `#google-save-${serial}`,
  };
}

/** Fetch org stats */
export async function fetchOrgStats(orgId: string): Promise<OrgStats> {
  await delay(300);
  return {
    org: {
      id: orgId,
      publicName: 'Dessert Club',
      legalName: 'Dessert Club Alimentos Ltda',
      plan: 'pro',
    },
    stores: [
      {
        id: 'store_dessertclub_sp',
        name: 'Loja SP — Centro',
        activeDesignVersion: 1,
      },
    ],
    counters: {
      customers: Object.keys(demoCards).length,
      stampsAllTime: Object.values(demoCards).reduce((sum, c) => sum + c.stamps, 0),
      redemptionsAllTime: Object.values(demoCards).filter(c => c.cycle > 1).length,
    },
  };
}

/** Fetch organizations list */
export async function fetchOrganizations(): Promise<Organization[]> {
  await delay(300);
  return [...demoOrgs];
}

/** Create a new organization */
export async function createOrganization(data: {
  publicName: string;
  legalName: string;
  slug: string;
  plan: string;
  ownerName: string;
  ownerEmail: string;
  rewardLabel: string;
}): Promise<{ org: Organization }> {
  await delay(400);
  const newOrg: Organization = {
    id: `org_${data.slug.replace(/-/g, '')}`,
    publicName: data.publicName,
    legalName: data.legalName,
    slug: data.slug,
    plan: data.plan,
    status: 'active',
    createdAt: new Date().toISOString(),
  };
  demoOrgs.push(newOrg);
  return { org: newOrg };
}

/** Search customer for reissuance */
export async function searchCustomer(query: string): Promise<{
  customer: { name: string; email: string };
  card: { serial: string; stamps: number; cycle: number };
} | null> {
  await delay(300);
  const q = query.toLowerCase();
  for (const card of Object.values(demoCards)) {
    if (
      card.customer.name.toLowerCase().includes(q) ||
      card.customer.email.toLowerCase().includes(q)
    ) {
      return {
        customer: { name: card.customer.name, email: card.customer.email },
        card: { serial: card.serial, stamps: card.stamps, cycle: card.cycle },
      };
    }
  }
  throw new Error('Cliente não encontrado nesta loja.');
}

/** Find customer for reissue (helper) */
export async function findCustomerForReissue(query: string): Promise<{
  name: string;
  email: string;
  stamps: number;
  serial: string;
} | null> {
  await delay(300);
  const q = query.toLowerCase();
  for (const c of demoCustomers) {
    if (c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)) {
      return {
        name: c.name,
        email: c.email,
        stamps: c.stamps,
        serial: c.serial,
      };
    }
  }
  return {
    name: 'Maria Silva',
    email: 'maria@exemplo.com',
    stamps: 8,
    serial: '8f3a-92bc-41de-aa22',
  };
}

/** Get all demo cards for the CRM table */
export function getAllCards(): CardData[] {
  return Object.values(demoCards);
}

