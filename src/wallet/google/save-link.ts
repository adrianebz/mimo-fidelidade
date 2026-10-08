import jwt from 'jsonwebtoken';
import { Card, CardDesignConfig, Organization } from '../../types/index.js';

export interface GoogleLoyaltyObject {
  id: string;
  classId: string;
  state: 'ACTIVE' | 'COMPLETED' | 'EXPIRED';
  accountName: string;
  accountId: string;
  loyaltyPoints: {
    label: string;
    balance: { string: string };
  };
  barcode: {
    type: string;
    value: string;
    alternateText: string;
  };
  heroImage?: {
    sourceUri: { uri: string };
  };
  textModulesData: Array<{
    id: string;
    header: string;
    body: string;
  }>;
  hexBackgroundColor?: string;
}

export function buildGoogleLoyaltyObject(
  card: Card,
  org: Organization,
  design: CardDesignConfig,
  baseUrl: string
): GoogleLoyaltyObject {
  const issuerId = process.env.GOOGLE_ISSUER_ID || '3388000000022114455';
  const cleanSerial = card.serial.replace(/[^a-zA-Z0-9._-]/g, '_');
  const classId = `${issuerId}.${org.slug.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const objectId = `${issuerId}.${cleanSerial}`;

  const remaining = Math.max(0, 10 - card.stampsCount);
  const rewardBody = remaining === 0
    ? `Parabéns! Sua recompensa (${design.rewardLabel}) está pronta para resgate no balcão.`
    : `Faltam ${remaining} ${remaining === 1 ? 'selo' : 'selos'} para o seu ${design.rewardLabel}.`;

  return {
    id: objectId,
    classId,
    state: 'ACTIVE',
    accountName: card.customerName,
    accountId: card.serial,
    loyaltyPoints: {
      label: 'Selos',
      balance: { string: `${card.stampsCount}/10` }
    },
    barcode: {
      type: 'QR_CODE',
      value: card.serial,
      alternateText: org.publicName
    },
    heroImage: {
      sourceUri: { uri: `${baseUrl}/api/passes/strip/${card.serial}.svg?v=${card.designVersion}` }
    },
    hexBackgroundColor: design.backgroundColor || '#0F0F10',
    textModulesData: [
      {
        id: 'reward_info',
        header: 'Recompensa',
        body: rewardBody
      },
      {
        id: 'cycle_info',
        header: 'Ciclo',
        body: `Você está no ciclo #${card.cycle}.`
      }
    ]
  };
}

export function generateGoogleWalletSaveUrl(
  card: Card,
  org: Organization,
  design: CardDesignConfig,
  baseUrl: string
): string {
  const loyaltyObject = buildGoogleLoyaltyObject(card, org, design, baseUrl);
  const serviceAccount = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || 'mimo-wallet-issuer@mimo-2d6eb.iam.gserviceaccount.com';
  // Sem fallback embutido de propósito: um segredo conhecido no código anula a
  // rotação da chave e deixa qualquer um forjar o token. Melhor falhar alto.
  const secretKey = process.env.JWT_SECRET;
  if (!secretKey) {
    throw new Error('JWT_SECRET não definido. Configure-o no .env antes de gerar links da carteira.');
  }

  const claims = {
    iss: serviceAccount,
    aud: 'google',
    typ: 'savetowallet',
    origins: [baseUrl],
    payload: {
      loyaltyObjects: [loyaltyObject]
    }
  };

  // Sign JWT
  const token = jwt.sign(claims, secretKey, { algorithm: 'HS256', expiresIn: '30d' });
  return `https://pay.google.com/gp/v/save/${token}`;
}
