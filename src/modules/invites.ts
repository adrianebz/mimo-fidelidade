import { v4 as uuidv4 } from 'uuid';
import { db, ConflictError, GoneError, NotFoundError } from '../db/firestore.js';
import { Invite } from '../types/index.js';

export function createInviteToken(orgId: string, storeId: string, staffId: string): Invite {
  const token = `inv_${uuidv4().replace(/-/g, '').substring(0, 16)}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString(); // 15 minutes

  const invite: Invite = {
    token,
    organizationId: orgId,
    storeId,
    issuedBy: staffId,
    expiresAt,
    createdAt: now.toISOString()
  };

  db.set(`organizations/${orgId}/invites/${token}`, invite);

  // Global index for lookup by token
  db.set(`invites_by_token/${token}`, { organizationId: orgId, storeId, token });

  return invite;
}

export function lookupInvite(token: string): { invite: Invite; orgName: string; rewardLabel: string } {
  const index = db.get(`invites_by_token/${token}`);
  if (!index) {
    throw new NotFoundError('INVITE_NOT_FOUND', 'Convite não encontrado.');
  }

  const invite: Invite = db.get(`organizations/${index.organizationId}/invites/${token}`);
  if (!invite) {
    throw new NotFoundError('INVITE_NOT_FOUND', 'Convite não encontrado.');
  }

  if (invite.usedAt) {
    throw new ConflictError('INVITE_ALREADY_USED', 'Este convite já foi utilizado.');
  }

  if (new Date(invite.expiresAt).getTime() < Date.now()) {
    throw new GoneError('INVITE_EXPIRED', 'Este convite expirou (validade de 15 minutos). Solicite um novo no balcão.');
  }

  const org = db.get(`organizations/${invite.organizationId}`);
  const store = db.get(`organizations/${invite.organizationId}/stores/${invite.storeId}`);

  return {
    invite,
    orgName: org?.publicName || 'Loja Parceira',
    rewardLabel: store?.rewardLabel || 'Recompensa Especial'
  };
}
