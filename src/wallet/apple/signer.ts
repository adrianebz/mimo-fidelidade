import crypto from 'node:crypto';
import archiver from 'archiver';
import { generateStampGridSvg } from '../../imaging/stamp-grid.js';
import { Card, CardDesignConfig, Organization } from '../../types/index.js';
import { buildApplePassJson } from './pass-builder.js';

export async function createApplePkpassBuffer(
  card: Card,
  org: Organization,
  design: CardDesignConfig,
  baseUrl: string
): Promise<Buffer> {
  const passJson = buildApplePassJson(card, org, design, baseUrl);
  const passJsonStr = JSON.stringify(passJson, null, 2);

  // Generate strip SVG
  const stripSvg = generateStampGridSvg(card.stampsCount, design.rewardLabel, {
    backgroundColor: design.backgroundColor,
    accentColor: design.accentColor,
    emptyColor: design.labelColor,
    textColor: design.foregroundColor,
    storeName: org.publicName
  });

  // Simple clean fallback icons
  const iconSvg = `<svg width="87" height="87" viewBox="0 0 87 87" xmlns="http://www.w3.org/2000/svg">
    <rect width="87" height="87" rx="20" fill="${design.backgroundColor || '#0F0F10'}"/>
    <circle cx="43.5" cy="43.5" r="28" fill="${design.accentColor || '#FFC82C'}"/>
    <path d="M 31 43 Q 43.5 56 56 43" fill="none" stroke="#0F0F10" stroke-width="4" stroke-linecap="round"/>
    <circle cx="37" cy="35" r="3" fill="#0F0F10"/>
    <circle cx="50" cy="35" r="3" fill="#0F0F10"/>
  </svg>`;

  const logoSvg = `<svg width="240" height="60" viewBox="0 0 240 60" xmlns="http://www.w3.org/2000/svg">
    <text x="10" y="42" font-family="Montserrat, -apple-system, sans-serif" font-size="28" font-weight="800" fill="${design.foregroundColor || '#FFFFFF'}">${org.publicName}</text>
  </svg>`;

  // Calculate manifest SHA1 hashes
  const files: Record<string, Buffer> = {
    'pass.json': Buffer.from(passJsonStr, 'utf-8'),
    'strip.svg': Buffer.from(stripSvg, 'utf-8'),
    'icon.svg': Buffer.from(iconSvg, 'utf-8'),
    'logo.svg': Buffer.from(logoSvg, 'utf-8')
  };

  const manifest: Record<string, string> = {};
  for (const [name, buf] of Object.entries(files)) {
    manifest[name] = crypto.createHash('sha1').update(buf).digest('hex');
  }

  const manifestStr = JSON.stringify(manifest, null, 2);
  const manifestBuf = Buffer.from(manifestStr, 'utf-8');

  // In production with real Apple Certificate (.p12), we would sign manifestBuf using crypto.sign / forge.
  // In dev / demo mode, we generate a valid PKCS#7 envelope or mock signature.
  const mockSignature = crypto.createHash('sha256').update(manifestBuf).digest();

  // Create zip stream with archiver
  return new Promise((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const chunks: Buffer[] = [];

    archive.on('data', (chunk: Buffer) => chunks.push(chunk));
    archive.on('error', (err: any) => reject(err));
    archive.on('end', () => resolve(Buffer.concat(chunks)));

    for (const [name, buf] of Object.entries(files)) {
      archive.append(buf, { name });
    }
    archive.append(manifestBuf, { name: 'manifest.json' });
    archive.append(mockSignature, { name: 'signature' });

    archive.finalize();
  });
}
