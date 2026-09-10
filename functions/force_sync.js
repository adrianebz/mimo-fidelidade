const admin = require('firebase-admin');
admin.initializeApp({
  projectId: process.env.GCLOUD_PROJECT || 'mimo-2d6eb'
});

async function run() {
  const db = admin.firestore();
  const snap = await db.collection('lojistas').get();
  let count = 0;
  for (const doc of snap.docs) {
    await doc.ref.update({
      'layout.versao': `v${Date.now()}`
    });
    count++;
    console.log(`Updated ${doc.id}`);
  }
  console.log(`Updated ${count} lojistas. Synchronization triggered!`);
}

run().catch(console.error);
