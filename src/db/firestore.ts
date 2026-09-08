import { 
  Organization, Store, Member, Customer, Card, Stamp, 
  Redemption, Invite, CardDesign, OrgCounters, IdempotencyRecord, AuditEvent 
} from '../types/index.js';

export class ConflictError extends Error {
  constructor(public code: string, message?: string) {
    super(message || code);
    this.name = 'ConflictError';
  }
}

export class NotFoundError extends Error {
  constructor(public code: string = 'NOT_FOUND', message?: string) {
    super(message || code);
    this.name = 'NotFoundError';
  }
}

export class ForbiddenError extends Error {
  constructor(public code: string = 'FORBIDDEN', message?: string) {
    super(message || code);
    this.name = 'ForbiddenError';
  }
}

export class GoneError extends Error {
  constructor(public code: string = 'GONE', message?: string) {
    super(message || code);
    this.name = 'GoneError';
  }
}

/**
 * In-memory transactional database engine mimicking Cloud Firestore semantics
 * with pessimistic locking, isolation enforcement, uniques, and collection group queries.
 */
class MimoDatabase {
  private documents: Map<string, any> = new Map();
  private locks: Set<string> = new Set();

  constructor() {
    this.seedInitialData();
  }

  // Get raw document by path
  get(path: string): any | undefined {
    const data = this.documents.get(path);
    return data ? JSON.parse(JSON.stringify(data)) : undefined;
  }

  // Set document by path
  set(path: string, data: any): void {
    this.documents.set(path, JSON.parse(JSON.stringify(data)));
  }

  // Delete document
  delete(path: string): boolean {
    return this.documents.delete(path);
  }

  // List all documents matching prefix
  listPrefix(prefix: string): Array<{ path: string; data: any }> {
    const results: Array<{ path: string; data: any }> = [];
    for (const [path, data] of this.documents.entries()) {
      if (path.startsWith(prefix)) {
        results.push({ path, data: JSON.parse(JSON.stringify(data)) });
      }
    }
    return results;
  }

  /**
   * Execute transactional operation with pessimistic document locks
   */
  async runTransaction<T>(updateFunction: (tx: TransactionContext) => Promise<T>): Promise<T> {
    const lockedKeys: string[] = [];

    const txLocks = new Set<string>();
    const acquireLock = (path: string) => {
      if (txLocks.has(path)) {
        return; // Already acquired by this transaction
      }
      if (this.locks.has(path)) {
        throw new ConflictError('TRANSACTION_LOCK_CONTENTION', `Resource ${path} is currently locked`);
      }
      this.locks.add(path);
      txLocks.add(path);
      lockedKeys.push(path);
    };

    const tx = new TransactionContext(this, acquireLock);

    try {
      const result = await updateFunction(tx);
      // Commit pending writes
      tx.commit();
      return result;
    } finally {
      // Release all acquired locks
      for (const key of lockedKeys) {
        this.locks.delete(key);
      }
    }
  }

  /**
   * Collection group query simulator
   * Enforces that collection group queries MUST require an organizationId filter in production code,
   * otherwise returning all cross-tenant items which tests can assert against.
   */
  collectionGroup(collectionName: string, filterOrgId?: string): any[] {
    const results: any[] = [];
    for (const [path, data] of this.documents.entries()) {
      const segments = path.split('/');
      // Check if any segment is the collection name
      const idx = segments.indexOf(collectionName);
      if (idx !== -1 && idx === segments.length - 2) {
        if (filterOrgId) {
          if (data.organizationId === filterOrgId) {
            results.push(JSON.parse(JSON.stringify(data)));
          }
        } else {
          // Unfiltered collection group query across all orgs
          results.push(JSON.parse(JSON.stringify(data)));
        }
      }
    }
    return results;
  }

  private seedInitialData() {
    // Seed default organization: "Dessert Club"
    const orgId = 'org_dessertclub';
    const storeId = 'store_dessertclub_sp';
    const ownerId = 'usr_owner_dessertclub';
    const clerkId = 'usr_clerk_ana';

    const org: Organization = {
      id: orgId,
      legalName: 'Dessert Club Confeitaria Ltda',
      publicName: 'Dessert Club',
      slug: 'dessert-club',
      plan: 'pro',
      active: true,
      createdAt: '2026-09-01T10:00:00.000Z',
      updatedAt: '2026-09-01T10:00:00.000Z'
    };

    const store: Store = {
      id: storeId,
      organizationId: orgId,
      name: 'Dessert Club — Jardins',
      slug: 'jardins',
      timezone: 'America/Sao_Paulo',
      stampsRequired: 10,
      rewardLabel: 'Cookie Grátis',
      activeDesignVersion: 1,
      createdAt: '2026-09-01T10:00:00.000Z'
    };

    const owner: Member = {
      id: ownerId,
      organizationId: orgId,
      storeIds: [storeId],
      name: 'Carlos Oliveira',
      email: 'carlos@dessertclub.com.br',
      role: 'owner',
      active: true,
      createdAt: '2026-09-01T10:00:00.000Z'
    };

    const clerk: Member = {
      id: clerkId,
      organizationId: orgId,
      storeIds: [storeId],
      name: 'Ana Balconista',
      email: 'ana@dessertclub.com.br',
      role: 'clerk',
      active: true,
      createdAt: '2026-09-01T10:00:00.000Z'
    };

    const design: CardDesign = {
      version: 1,
      organizationId: orgId,
      storeId: storeId,
      config: {
        backgroundColor: '#0F0F10',
        foregroundColor: '#FFFFFF',
        labelColor: '#8ABABF',
        accentColor: '#FFC82C',
        rewardLabel: 'Cookie Grátis',
        stampIcon: 'coin',
        showMimoBranding: true
      },
      status: 'published',
      publishedAt: '2026-09-01T10:00:00.000Z',
      publishedBy: ownerId,
      createdAt: '2026-09-01T10:00:00.000Z'
    };

    const counters: OrgCounters = {
      totals: {
        customers: 1,
        cardsActive: 1,
        stampsAllTime: 8,
        redemptionsAllTime: 0
      },
      daily: {
        '2026-09-05': { stamps: 8, redemptions: 0, newCustomers: 1 }
      }
    };

    // Customer test: Maria Silva
    const customerId = 'cus_maria_01';
    const cardSerial = '8f3a-92bc-41de-aa22';
    const customer: Customer = {
      id: customerId,
      organizationId: orgId,
      storeId: storeId,
      firstName: 'Maria',
      lastName: 'Silva',
      email: 'maria@exemplo.com',
      emailLower: 'maria@exemplo.com',
      phoneE164: '+5511987654321',
      birthDate: '1992-04-17',
      birthMonth: 4,
      cardId: cardSerial,
      consentAt: '2026-09-02T14:00:00.000Z',
      consentVersion: 'v1.0-lgpd',
      createdAt: '2026-09-02T14:00:00.000Z'
    };

    const card: Card = {
      id: cardSerial,
      serial: cardSerial,
      organizationId: orgId,
      storeId: storeId,
      customerId: customerId,
      authToken: 'tok_apple_auth_99182736',
      stampsCount: 8,
      cycle: 1,
      lastStampAt: '2026-09-05T12:00:00.000Z',
      customerName: 'Maria Silva',
      customerEmailMasked: 'ma****@exemplo.com',
      designVersion: 1,
      appleIssuedAt: '2026-09-02T14:01:00.000Z',
      googleIssuedAt: '2026-09-02T14:01:00.000Z',
      createdAt: '2026-09-02T14:00:00.000Z',
      updatedAt: '2026-09-05T12:00:00.000Z'
    };

    // Save seeded entities
    this.set(`organizations/${orgId}`, org);
    this.set(`organizations/${orgId}/stores/${storeId}`, store);
    this.set(`organizations/${orgId}/members/${ownerId}`, owner);
    this.set(`organizations/${orgId}/members/${clerkId}`, clerk);
    this.set(`organizations/${orgId}/designs/1`, design);
    this.set(`organizations/${orgId}/counters/totals`, counters);
    this.set(`organizations/${orgId}/uniques/email_maria@exemplo.com`, { customerId, createdAt: '2026-09-02T14:00:00.000Z' });
    this.set(`organizations/${orgId}/uniques/card_${customerId}`, { cardSerial, createdAt: '2026-09-02T14:00:00.000Z' });
    this.set(`organizations/${orgId}/customers/${customerId}`, customer);
    this.set(`organizations/${orgId}/cards/${cardSerial}`, card);
    this.set(`cards_by_serial/${cardSerial}`, { organizationId: orgId, storeId: storeId, customerId });

    // Initial stamps for Maria (8 stamps)
    for (let i = 1; i <= 8; i++) {
      const stampId = `stamp_maria_${i}`;
      const stamp: Stamp = {
        id: stampId,
        organizationId: orgId,
        storeId: storeId,
        cardId: cardSerial,
        staffId: clerkId,
        cycle: 1,
        source: 'staff_scan',
        createdAt: `2026-09-0${Math.min(i, 5)}T10:00:00.000Z`
      };
      this.set(`organizations/${orgId}/stamps/${stampId}`, stamp);
    }
  }
}

export class TransactionContext {
  private pendingCreates: Map<string, any> = new Map();
  private pendingUpdates: Map<string, any> = new Map();
  private pendingDeletes: Set<string> = new Set();

  constructor(
    private db: MimoDatabase,
    private lockCallback: (path: string) => void
  ) {}

  get(path: string): { exists: boolean; data: () => any } {
    this.lockCallback(path);
    const existing = this.db.get(path);
    return {
      exists: existing !== undefined && !this.pendingDeletes.has(path),
      data: () => {
        if (this.pendingUpdates.has(path)) {
          return { ...existing, ...this.pendingUpdates.get(path) };
        }
        return existing;
      }
    };
  }

  create(path: string, data: any): void {
    this.lockCallback(path);
    const existing = this.db.get(path);
    if (existing !== undefined && !this.pendingDeletes.has(path)) {
      throw new ConflictError('DOCUMENT_ALREADY_EXISTS', `Document at ${path} already exists`);
    }
    this.pendingCreates.set(path, data);
  }

  update(path: string, partialData: any): void {
    this.lockCallback(path);
    const current = this.db.get(path);
    if (!current && !this.pendingCreates.has(path)) {
      throw new NotFoundError('DOCUMENT_NOT_FOUND', `Cannot update non-existent document at ${path}`);
    }

    const merged = { ...(current || this.pendingCreates.get(path)), ...partialData };
    this.pendingUpdates.set(path, merged);
  }

  delete(path: string): void {
    this.lockCallback(path);
    this.pendingDeletes.add(path);
    this.pendingCreates.delete(path);
    this.pendingUpdates.delete(path);
  }

  commit(): void {
    for (const path of this.pendingDeletes) {
      this.db.delete(path);
    }
    for (const [path, data] of this.pendingCreates) {
      this.db.set(path, data);
    }
    for (const [path, data] of this.pendingUpdates) {
      this.db.set(path, data);
    }
  }
}

export const db = new MimoDatabase();
