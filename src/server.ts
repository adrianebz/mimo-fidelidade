import fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { createInviteToken, lookupInvite } from './modules/invites.js';
import { enrollCustomer } from './modules/customers.js';
import { getCardState, stampCard } from './modules/stamps.js';
import { redeemReward } from './modules/redemptions.js';
import { findCustomerInOrg, createReissueLink } from './modules/reissue.js';
import { getActiveDesign, publishDesign, validateContrast } from './modules/design.js';
import { createOrganization, exportOrganizationCsv, getOrganizationDetails, listAllOrganizations } from './modules/organizations.js';
import { generateStampGridSvg } from './imaging/stamp-grid.js';
import { createApplePkpassBuffer } from './wallet/apple/signer.js';
import { generateGoogleWalletSaveUrl } from './wallet/google/save-link.js';
import { db } from './db/firestore.js';
import { Card, Organization } from './types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3333', 10);
const HOST = process.env.HOST || '0.0.0.0';
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

const app = fastify({
  logger: true
});

const clientDistPath = path.resolve(__dirname, '../client/dist');

// Global error handler
app.setErrorHandler((error: any, request, reply) => {
  app.log.error(error);

  if (error.name === 'ZodError') {
    return reply.status(400).send({
      error: {
        code: 'VALIDATION_ERROR',
        message: error.errors?.[0]?.message || 'Dados inválidos.',
        details: error.errors
      }
    });
  }

  if (error.name === 'ConflictError') {
    return reply.status(409).send({
      error: {
        code: error.code || 'CONFLICT',
        message: error.message
      }
    });
  }

  if (error.name === 'NotFoundError') {
    return reply.status(404).send({
      error: {
        code: error.code || 'NOT_FOUND',
        message: error.message
      }
    });
  }

  if (error.name === 'GoneError') {
    return reply.status(410).send({
      error: {
        code: error.code || 'GONE',
        message: error.message
      }
    });
  }

  return reply.status(error.statusCode || 500).send({
    error: {
      code: error.code || 'INTERNAL_ERROR',
      message: error.message || 'Ocorreu um erro interno no servidor.'
    }
  });
});

// ==========================================
// ROUTES
// ==========================================

// Health check
app.get('/api/health', async () => {
  return { status: 'healthy', platform: 'MIMO — Fidelidade Digital', version: '2.0.0' };
});

// 1. Invites
app.post('/api/invites', async (request, reply) => {
  const body = (request.body as any) || {};
  const orgId = body.organizationId || 'org_dessertclub';
  const storeId = body.storeId || 'store_dessertclub_sp';
  const staffId = body.staffId || 'usr_clerk_ana';

  const invite = createInviteToken(orgId, storeId, staffId);
  const qrPayload = `${BASE_URL}/entrar/${invite.token}`;

  return reply.status(201).send({
    token: invite.token,
    qr_payload: qrPayload,
    expires_at: invite.expiresAt
  });
});

// 2. Public enrollment lookup
app.get('/api/enroll/:token', async (request, reply) => {
  const { token } = request.params as { token: string };
  const info = lookupInvite(token);
  return reply.send({
    valid: true,
    token: info.invite.token,
    store_name: info.orgName,
    reward_label: info.rewardLabel,
    expires_at: info.invite.expiresAt
  });
});

// 3. Public customer enrollment submission
app.post('/api/enroll/:token', async (request, reply) => {
  const { token } = request.params as { token: string };
  const body = request.body as any;

  const result = await enrollCustomer(token, body, BASE_URL);
  return reply.status(201).send(result);
});

// 4. Card lookup (Balcão scanner)
app.get('/api/cards/:serial', async (request, reply) => {
  const { serial } = request.params as { serial: string };
  const state = getCardState(serial);
  return reply.send(state);
});

// 5. Card Stamping (Carimbo no balcão)
app.post('/api/cards/:serial/stamp', async (request, reply) => {
  const { serial } = request.params as { serial: string };
  const body = (request.body as any) || {};
  const staffId = body.staffId || 'usr_clerk_ana';

  // Extract or generate idempotency key
  const idempotencyKey =
    (request.headers['idempotency-key'] as string) ||
    body.idempotencyKey ||
    `stamp_${serial}_${Date.now()}`;

  const result = await stampCard(serial, staffId, idempotencyKey);
  if (result.isIdempotentReplay) {
    reply.header('Idempotent-Replay', 'true');
  }

  return reply.status(200).send(result);
});

// 6. Reward Redemption (Resgate de recompensa)
app.post('/api/cards/:serial/redeem', async (request, reply) => {
  const { serial } = request.params as { serial: string };
  const body = (request.body as any) || {};
  const staffId = body.staffId || 'usr_clerk_ana';

  const result = await redeemReward(serial, staffId);
  return reply.status(200).send(result);
});

// 7. Customer search and Card Reissuance (Reemissão por perda de aparelho)
app.get('/api/cards/find', async (request, reply) => {
  const { orgId, query } = request.query as { orgId: string; query: string };
  if (!orgId || !query) {
    return reply.status(400).send({ error: { message: 'orgId e query são obrigatórios.' } });
  }

  const result = findCustomerInOrg(orgId, query);
  return reply.send({
    customer: {
      name: `${result.customer.firstName} ${result.customer.lastName}`,
      email: result.customer.email,
      phone: result.customer.phoneE164,
      createdAt: result.customer.createdAt
    },
    card: {
      serial: result.card.serial,
      stamps: result.card.stampsCount,
      cycle: result.card.cycle
    }
  });
});

app.post('/api/cards/reissue', async (request, reply) => {
  const body = request.body as { orgId: string; cardSerial: string };
  if (!body.orgId || !body.cardSerial) {
    return reply.status(400).send({ error: { message: 'orgId e cardSerial são obrigatórios.' } });
  }

  const result = createReissueLink(body.orgId, body.cardSerial, BASE_URL);
  return reply.send(result);
});

// 8. Apple Wallet .pkpass download
app.get('/api/passes/apple/:serial', async (request, reply) => {
  const { serial } = request.params as { serial: string };
  const index = db.get(`cards_by_serial/${serial}`);
  if (!index) {
    return reply.status(404).send('Cartão não encontrado.');
  }

  const card: Card = db.get(`organizations/${index.organizationId}/cards/${serial}`);
  const org: Organization = db.get(`organizations/${index.organizationId}`);
  const design = getActiveDesign(index.organizationId);

  const pkpassBuffer = await createApplePkpassBuffer(card, org, design.config, BASE_URL);

  return reply
    .type('application/vnd.apple.pkpass')
    .header('Content-Disposition', `attachment; filename="${org.slug}-fidelidade.pkpass"`)
    .send(pkpassBuffer);
});

// 9. Google Wallet Save URL redirect
app.get('/api/passes/google/:serial/save', async (request, reply) => {
  const { serial } = request.params as { serial: string };
  const index = db.get(`cards_by_serial/${serial}`);
  if (!index) {
    return reply.status(404).send('Cartão não encontrado.');
  }

  const card: Card = db.get(`organizations/${index.organizationId}/cards/${serial}`);
  const org: Organization = db.get(`organizations/${index.organizationId}`);
  const design = getActiveDesign(index.organizationId);

  const googleUrl = generateGoogleWalletSaveUrl(card, org, design.config, BASE_URL);
  return reply.redirect(googleUrl);
});

// 10. Dynamic SVG stamp grid
app.get('/api/passes/strip/:serial.svg', async (request, reply) => {
  const { serial } = request.params as { serial: string };
  const index = db.get(`cards_by_serial/${serial}`);

  let stamps = 0;
  let rewardLabel = 'Recompensa';
  let design = getActiveDesign(index?.organizationId || 'org_dessertclub');

  if (index) {
    const card: Card = db.get(`organizations/${index.organizationId}/cards/${serial}`);
    if (card) {
      stamps = card.stampsCount;
    }
  }

  const svg = generateStampGridSvg(stamps, design.config.rewardLabel || rewardLabel, {
    backgroundColor: design.config.backgroundColor,
    accentColor: design.config.accentColor,
    emptyColor: design.config.labelColor,
    textColor: design.config.foregroundColor
  });

  return reply.type('image/svg+xml').send(svg);
});

// 11. Design Builder API
app.get('/api/design/:orgId', async (request, reply) => {
  const { orgId } = request.params as { orgId: string };
  const design = getActiveDesign(orgId);
  const contrast = validateContrast(design.config);

  return reply.send({
    design,
    contrast
  });
});

app.post('/api/design/:orgId/publish', async (request, reply) => {
  const { orgId } = request.params as { orgId: string };
  const body = request.body as any;
  const storeId = body.storeId || `store_${orgId.replace('org_', '')}_sp`;
  const publishedBy = body.publishedBy || 'usr_owner';

  const published = publishDesign(orgId, storeId, body.config, publishedBy);
  return reply.send(published);
});

// 12. Organization Stats & CSV Export
app.get('/api/organizations/:orgId/stats', async (request, reply) => {
  const { orgId } = request.params as { orgId: string };
  const details = getOrganizationDetails(orgId);
  return reply.send(details);
});

app.get('/api/admin/export/:orgId', async (request, reply) => {
  const { orgId } = request.params as { orgId: string };
  const csv = exportOrganizationCsv(orgId);

  return reply
    .type('text/csv')
    .header('Content-Disposition', `attachment; filename="mimo-${orgId}-clientes.csv"`)
    .send(csv);
});

// 13. Platform Admin (Multi-tenant governance)
app.get('/api/platform/organizations', async (request, reply) => {
  const orgs = listAllOrganizations();
  return reply.send(orgs);
});

app.post('/api/platform/organizations', async (request, reply) => {
  const body = request.body as any;
  const created = createOrganization(body);
  return reply.status(201).send(created);
});

// Start Server
async function start() {
  try {
    // Enable CORS
    await app.register(cors, {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key']
    });

    // Serve frontend static files if client/dist exists
    if (fs.existsSync(clientDistPath)) {
      await app.register(fastifyStatic, {
        root: clientDistPath,
        prefix: '/'
      });
    }

    // Fallback for SPA client-side routes (e.g. /entrar/*, /balcao, /loja)
    app.setNotFoundHandler((request, reply) => {
      if (request.raw.url?.startsWith('/api/')) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: 'Endpoint de API não encontrado.'
          }
        });
      }
      const indexPath = path.resolve(clientDistPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        return reply.type('text/html').send(fs.readFileSync(indexPath, 'utf-8'));
      }
      return reply.status(404).send('Página não encontrada.');
    });

    await app.listen({ port: PORT, host: HOST });
    console.log(`\n🚀 MIMO Fidelidade Digital rodando em ${BASE_URL}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
