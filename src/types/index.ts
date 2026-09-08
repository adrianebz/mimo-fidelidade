export type UserRole = 'platform_admin' | 'owner' | 'manager' | 'clerk';

export interface Organization {
  id: string;
  legalName: string;
  publicName: string;
  slug: string;
  plan: 'starter' | 'pro' | 'unlimited';
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Store {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  timezone: string;
  stampsRequired: number; // standard: 10
  rewardLabel: string;
  activeDesignVersion: number;
  createdAt: string;
}

export interface Member {
  id: string;
  organizationId: string;
  storeIds: string[];
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
}

export interface Customer {
  id: string;
  organizationId: string;
  storeId: string;
  firstName: string;
  lastName: string;
  email: string;
  emailLower: string;
  birthDate?: string | null; // YYYY-MM-DD
  birthMonth?: number | null;
  phoneE164?: string | null;
  cardId: string; // reference to card serial
  consentAt: string;
  consentVersion: string;
  createdAt: string;
  deletedAt?: string | null;
}

export interface Card {
  id: string; // cardId === serial (UUID)
  serial: string;
  organizationId: string;
  storeId: string;
  customerId: string;
  authToken: string; // Apple web service auth token
  stampsCount: number; // 0 to 10
  cycle: number; // 1, 2, ...
  lastStampAt?: string | null;
  customerName: string;
  customerEmailMasked: string;
  designVersion: number;
  appleIssuedAt?: string | null;
  googleIssuedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Stamp {
  id: string;
  organizationId: string;
  storeId: string;
  cardId: string;
  staffId: string;
  cycle: number;
  source: 'staff_scan' | 'manual_adjust' | 'signup_bonus' | 'migration';
  note?: string | null;
  createdAt: string;
}

export interface Redemption {
  id: string; // Deterministic: `${cardId}_${cycle}`
  organizationId: string;
  storeId: string;
  cardId: string;
  staffId: string;
  cycle: number;
  rewardLabel: string;
  createdAt: string;
}

export interface Invite {
  token: string;
  organizationId: string;
  storeId: string;
  issuedBy: string;
  usedAt?: string | null;
  customerId?: string | null;
  expiresAt: string; // +15 minutes from creation
  createdAt: string;
}

export interface CardDesignConfig {
  backgroundColor: string; // default #0F0F10
  foregroundColor: string; // default #FFFFFF
  labelColor: string;       // default #8ABABF
  accentColor: string;      // default #FFC82C
  logoUrl?: string;
  rewardLabel: string;      // e.g. "Cookie Grátis"
  stampIcon: 'coin' | 'smile' | 'star' | 'coffee';
  showMimoBranding: boolean;
}

export interface CardDesign {
  version: number;
  organizationId: string;
  storeId: string;
  config: CardDesignConfig;
  status: 'draft' | 'published' | 'archived';
  publishedAt?: string | null;
  publishedBy?: string | null;
  createdAt: string;
}

export interface OrgCounters {
  totals: {
    customers: number;
    cardsActive: number;
    stampsAllTime: number;
    redemptionsAllTime: number;
  };
  daily: Record<string, { stamps: number; redemptions: number; newCustomers: number }>;
}

export interface IdempotencyRecord {
  key: string;
  organizationId: string;
  cardId: string;
  response: any;
  createdAt: string;
  expiresAt: string;
}

export interface AuditEvent {
  id: string;
  organizationId: string;
  storeId?: string;
  userId: string;
  action: 'invite_created' | 'customer_enrolled' | 'stamp_added' | 'reward_redeemed' | 'manual_adjust' | 'card_reissued' | 'design_published' | 'csv_exported';
  targetId: string;
  details?: Record<string, any>;
  createdAt: string;
}
