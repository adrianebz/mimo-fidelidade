import { Card, CardDesignConfig, Organization } from '../../types/index.js';

export interface ApplePassJson {
  formatVersion: number;
  passTypeIdentifier: string;
  serialNumber: string;
  teamIdentifier: string;
  organizationName: string;
  description: string;
  logoText: string;
  foregroundColor: string;
  backgroundColor: string;
  labelColor: string;
  storeCard: {
    headerFields: Array<{ key: string; label: string; value: string; textAlignment?: string }>;
    primaryFields: Array<{ key: string; label: string; value: string }>;
    secondaryFields: Array<{ key: string; label: string; value: string }>;
    auxiliaryFields: Array<{ key: string; label: string; value: string }>;
    backFields: Array<{ key: string; label: string; value: string }>;
  };
  barcodes: Array<{
    format: string;
    message: string;
    messageEncoding: string;
    altText: string;
  }>;
  webServiceURL?: string;
  authenticationToken?: string;
}

export function buildApplePassJson(
  card: Card,
  org: Organization,
  design: CardDesignConfig,
  baseUrl: string
): ApplePassJson {
  // Convert hex color to Apple rgb format e.g. #0F0F10 -> rgb(15, 15, 16)
  const hexToRgb = (hex: string, fallback: string = 'rgb(255,255,255)') => {
    const clean = hex.replace('#', '');
    if (clean.length !== 6) return fallback;
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    return `rgb(${r}, ${g}, ${b})`;
  };

  const isComplete = card.stampsCount >= 10;
  const rewardStatus = isComplete ? 'Recompensa Liberada!' : design.rewardLabel;

  return {
    formatVersion: 1,
    passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID || 'pass.com.mimo.fidelidade',
    serialNumber: card.serial,
    teamIdentifier: process.env.APPLE_TEAM_ID || 'MIMO123456',
    organizationName: org.publicName,
    description: `Fidelidade ${org.publicName}`,
    logoText: org.publicName,
    backgroundColor: hexToRgb(design.backgroundColor, 'rgb(15, 15, 16)'),
    foregroundColor: hexToRgb(design.foregroundColor, 'rgb(255, 255, 255)'),
    labelColor: hexToRgb(design.labelColor, 'rgb(138, 171, 191)'),
    storeCard: {
      headerFields: [
        {
          key: 'balance',
          label: 'SELOS',
          value: `${card.stampsCount}/10`,
          textAlignment: 'PKTextAlignmentRight'
        }
      ],
      primaryFields: [
        {
          key: 'customer',
          label: 'CLIENTE',
          value: card.customerName
        }
      ],
      secondaryFields: [
        {
          key: 'reward',
          label: isComplete ? 'STATUS' : 'PRÓXIMA RECOMPENSA',
          value: rewardStatus
        }
      ],
      auxiliaryFields: [
        {
          key: 'cycle',
          label: 'CICLO ATUAL',
          value: `#${card.cycle}`
        }
      ],
      backFields: [
        {
          key: 'info',
          label: 'Sobre o Programa',
          value: `Programa de fidelidade digital de ${org.publicName}. A cada carimbo no balcão você avança para a recompensa de ${design.rewardLabel}.`
        },
        {
          key: 'rules',
          label: 'Regras',
          value: '1. O cartão é pessoal e intransferível.\n2. Limite de 1 carimbo por compra.\n3. Complete 10 carimbos para resgatar sua recompensa.\n4. Ao resgatar, inicia-se um novo ciclo com contagem zerada.'
        },
        {
          key: 'platform',
          label: 'Plataforma',
          value: 'MIMO — Fidelidade em Carteira Digital'
        }
      ]
    },
    barcodes: [
      {
        format: 'PKBarcodeFormatQR',
        message: card.serial,
        messageEncoding: 'iso-8859-1',
        altText: 'Apresente no balcão'
      }
    ],
    webServiceURL: `${baseUrl}/api/passes/apple/v1/organizations/${org.id}`,
    authenticationToken: card.authToken
  };
}
