import 'dotenv/config';

import fs from 'node:fs';
import path from 'node:path';
import { db } from '../db/firestore.js';
import { getActiveDesign } from '../modules/design.js';
import { createApplePkpassBuffer } from '../wallet/apple/signer.js';
import { Card, Organization } from '../types/index.js';

/**
 * Gera um .pkpass com o código atual e grava em disco, para inspeção do
 * conteúdo real em vez de leitura do código.
 *
 * Uso: tsx src/tests/validar-pkpass.ts <caminho-de-saida>
 */
const SERIAL = '8f3a-92bc-41de-aa22';
const saida = process.argv[2] || 'passe-validacao.zip';

async function main() {
  const index = db.get(`cards_by_serial/${SERIAL}`);
  if (!index) {
    console.error(`Cartão ${SERIAL} não encontrado na base semeada.`);
    process.exit(1);
  }

  const card: Card = db.get(`organizations/${index.organizationId}/cards/${SERIAL}`);
  const org: Organization = db.get(`organizations/${index.organizationId}`);
  const design = getActiveDesign(index.organizationId);

  const buffer = await createApplePkpassBuffer(card, org, design.config, 'http://localhost:3333');

  fs.writeFileSync(saida, buffer);
  console.log(`gerado : ${path.resolve(saida)}`);
  console.log(`tamanho: ${buffer.length} bytes`);
  console.log(`loja   : ${org.publicName}`);
  console.log(`selos  : ${card.stampsCount}`);
}

main().catch((err) => {
  console.error('Falha ao gerar:', err);
  process.exit(1);
});
