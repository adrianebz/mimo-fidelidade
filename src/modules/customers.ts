import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { db, ConflictError, GoneError, NotFoundError } from '../db/firestore.js';
import { Card, Customer, Organization, Store, CardDesign } from '../types/index.js';
import { generateGoogleWalletSaveUrl } from '../wallet/google/save-link.js';

export const EnrollSchema = z.object({
  firstName: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  lastName: z.string().min(2, 'Sobrenome deve ter pelo menos 2 caracteres'),
  email: z.string().email('E-mail inválido'),
  phone: z.string().optional().nullable(),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato AAAA-MM-DD').optional().nullable(),
  consent: z.literal(true, { errorMap: () => ({ message: 'É obrigatório aceitar os termos e a política de privacidade' }) })
});

export type EnrollInput = z.infer<typeof EnrollSchema>;

export async function enrollCustomer(token: string, input: EnrollInput, baseUrl: string) {
  // Validate input
  const validated = EnrollSchema.parse(input);
  const emailLower = validated.email.trim().toLowerCase();

  const index = db.get(`invites_by_token/${token}`);
  if (!index) {
    throw new NotFoundError('INVITE_NOT_FOUND', 'Convite não encontrado.');
  }

  const { organizationId, storeId } = index;

  const result = await db.runTransaction(async (tx) => {
    // 1. Lock and validate invite
    const invitePath = `organizations/${organizationId}/invites/${token}`;
    const invDoc = tx.get(invitePath);
    if (!invDoc.exists) {
      throw new NotFoundError('INVITE_NOT_FOUND', 'Convite inexistente.');
    }
    const invite = invDoc.data();
    if (invite.usedAt) {
      throw new ConflictError('INVITE_ALREADY_USED', 'Este convite já foi utilizado.');
    }
    if (new Date(invite.expiresAt).getTime() < Date.now()) {
      throw new GoneError('INVITE_EXPIRED', 'Este convite expirou.');
    }

    // 2. Check and lock unique email per organization
    const emailUniquePath = `organizations/${organizationId}/uniques/email_${emailLower}`;
    const uniqueDoc = tx.get(emailUniquePath);
    if (uniqueDoc.exists) {
      throw new ConflictError('EMAIL_ALREADY_EXISTS', 'Este e-mail já possui um cartão cadastrado nesta loja. Peça a reemissão no balcão.');
    }

    // 3. Generate IDs
    const customerId = `cus_${uuidv4().replace(/-/g, '').substring(0, 16)}`;
    const cardSerial = uuidv4();
    const authToken = `tok_apple_${uuidv4().replace(/-/g, '')}`;
    const now = new Date().toISOString();

    // Masked email for security e.g. ma****@exemplo.com
    const [namePart, domainPart] = emailLower.split('@');
    const maskedEmail = `${namePart.substring(0, 2)}****@${domainPart}`;

    const customer: Customer = {
      id: customerId,
      organizationId,
      storeId,
      firstName: validated.firstName.trim(),
      lastName: validated.lastName.trim(),
      email: validated.email.trim(),
      emailLower,
      phoneE164: validated.phone || null,
      birthDate: validated.birthDate || null,
      birthMonth: validated.birthDate ? parseInt(validated.birthDate.split('-')[1], 10) : null,
      cardId: cardSerial,
      consentAt: now,
      consentVersion: 'v2.0-lgpd',
      createdAt: now
    };

    const card: Card = {
      id: cardSerial,
      serial: cardSerial,
      organizationId,
      storeId,
      customerId,
      authToken,
      stampsCount: 0,
      cycle: 1,
      customerName: `${validated.firstName.trim()} ${validated.lastName.trim()}`,
      customerEmailMasked: maskedEmail,
      designVersion: 1,
      createdAt: now,
      updatedAt: now
    };

    // Save uniqueness records
    tx.create(emailUniquePath, { customerId, createdAt: now });
    tx.create(`organizations/${organizationId}/uniques/card_${customerId}`, { cardSerial, createdAt: now });

    // Save customer and card
    tx.create(`organizations/${organizationId}/customers/${customerId}`, customer);
    tx.create(`organizations/${organizationId}/cards/${cardSerial}`, card);

    // Global serial to organization index for swift card lookups by QR
    tx.create(`cards_by_serial/${cardSerial}`, { organizationId, storeId, customerId });

    // Mark invite as consumed
    tx.update(invitePath, {
      usedAt: now,
      customerId
    });

    // Update counters
    const counterPath = `organizations/${organizationId}/counters/totals`;
    const counterDoc = tx.get(counterPath);
    if (counterDoc.exists) {
      const counters = counterDoc.data();
      tx.update(counterPath, {
        totals: {
          ...counters.totals,
          customers: (counters.totals?.customers || 0) + 1,
          cardsActive: (counters.totals?.cardsActive || 0) + 1
        }
      });
    }

    return { customer, card };
  });

  const org: Organization = db.get(`organizations/${organizationId}`);
  const store: Store = db.get(`organizations/${organizationId}/stores/${storeId}`);
  const designDoc: CardDesign = db.get(`organizations/${organizationId}/designs/${store.activeDesignVersion || 1}`) || {
    version: 1,
    organizationId,
    storeId,
    config: {
      backgroundColor: '#0F0F10',
      foregroundColor: '#FFFFFF',
      labelColor: '#8ABABF',
      accentColor: '#FFC82C',
      rewardLabel: store.rewardLabel || 'Cookie Grátis',
      stampIcon: 'coin',
      showMimoBranding: true
    },
    status: 'published',
    createdAt: new Date().toISOString()
  };

  const applePassUrl = `${baseUrl}/api/passes/apple/${result.card.serial}`;
  const googleSaveUrl = generateGoogleWalletSaveUrl(result.card, org, designDoc.config, baseUrl);

  return {
    cardSerial: result.card.serial,
    firstName: result.customer.firstName,
    customerName: result.card.customerName,
    stamps: 0,
    required: store.stampsRequired || 10,
    rewardLabel: store.rewardLabel,
    storeName: org.publicName,
    applePassUrl,
    googleSaveUrl
  };
}
