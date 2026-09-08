import { db, ConflictError, NotFoundError } from '../db/firestore.js';
import { CardDesign, CardDesignConfig, Store } from '../types/index.js';

/**
 * Calculate WCAG 2.1 relative luminance and contrast ratio
 */
export function getContrastRatio(hex1: string, hex2: string): number {
  const getLuminance = (hex: string) => {
    const clean = hex.replace('#', '');
    const r = parseInt(clean.substring(0, 2), 16) / 255;
    const g = parseInt(clean.substring(2, 4), 16) / 255;
    const b = parseInt(clean.substring(4, 6), 16) / 255;

    const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  };

  const l1 = getLuminance(hex1);
  const l2 = getLuminance(hex2);
  const brightest = Math.max(l1, l2);
  const darkest = Math.min(l1, l2);
  return Number(((brightest + 0.05) / (darkest + 0.05)).toFixed(2));
}

export function validateContrast(config: CardDesignConfig): { isValid: boolean; contrast: number; error?: string } {
  const contrast = getContrastRatio(config.backgroundColor, config.foregroundColor);
  if (contrast < 4.5) {
    return {
      isValid: false,
      contrast,
      error: `Contraste de ${contrast}:1 é insuficiente para leitura (mínimo WCAG AA recomendado é 4.5:1). Escureça o fundo ou clareie o texto.`
    };
  }
  return { isValid: true, contrast };
}

export function getActiveDesign(orgId: string): CardDesign {
  const store: Store = db.get(`organizations/${orgId}/stores/store_${orgId.replace('org_', '')}_sp`) ||
    db.listPrefix(`organizations/${orgId}/stores/`)[0]?.data;

  const version = store?.activeDesignVersion || 1;
  const design: CardDesign = db.get(`organizations/${orgId}/designs/${version}`);
  if (design) return design;

  return {
    version: 1,
    organizationId: orgId,
    storeId: store?.id || 'default_store',
    config: {
      backgroundColor: '#0F0F10',
      foregroundColor: '#FFFFFF',
      labelColor: '#8ABABF',
      accentColor: '#FFC82C',
      rewardLabel: store?.rewardLabel || 'Cookie Grátis',
      stampIcon: 'coin',
      showMimoBranding: true
    },
    status: 'published',
    createdAt: new Date().toISOString()
  };
}

export function publishDesign(orgId: string, storeId: string, config: CardDesignConfig, publishedBy: string) {
  // Validate contrast
  const contrastCheck = validateContrast(config);
  if (!contrastCheck.isValid) {
    throw new ConflictError('DESIGN_INVALID', contrastCheck.error);
  }

  // Check RN13: Max 1 publication per day per organization
  const designs = db.listPrefix(`organizations/${orgId}/designs/`);
  const now = new Date();
  const oneDayAgo = now.getTime() - 24 * 60 * 60 * 1000;

  for (const item of designs) {
    if (item.data.status === 'published' && item.data.publishedAt) {
      const pubTime = new Date(item.data.publishedAt).getTime();
      if (pubTime > oneDayAgo) {
        // Enforce daily limit unless in development / first version
        if (designs.length > 1) {
          throw new ConflictError('PUBLISH_LIMIT_REACHED', 'A publicação de novo design é limitada a uma vez por dia por organização.');
        }
      }
    }
  }

  const nextVersion = designs.length + 1;
  const nowIso = now.toISOString();

  const newDesign: CardDesign = {
    version: nextVersion,
    organizationId: orgId,
    storeId,
    config,
    status: 'published',
    publishedAt: nowIso,
    publishedBy,
    createdAt: nowIso
  };

  db.set(`organizations/${orgId}/designs/${nextVersion}`, newDesign);

  // Update store active version and reward label
  const storePath = `organizations/${orgId}/stores/${storeId}`;
  const store = db.get(storePath);
  if (store) {
    store.activeDesignVersion = nextVersion;
    if (config.rewardLabel) {
      store.rewardLabel = config.rewardLabel;
    }
    db.set(storePath, store);
  }

  return newDesign;
}
