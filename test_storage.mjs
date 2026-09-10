import admin from 'firebase-admin';
import fs from 'fs';

const sa = JSON.parse(fs.readFileSync('./functions/service-account-wallet.json', 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(sa),
    storageBucket: 'mimo-2d6eb.appspot.com'
  });
}

try {
  const bucket = admin.storage().bucket();
  const [files] = await bucket.getFiles({ maxResults: 5 });
  console.log('Bucket files:', files.map(f => f.name));
} catch (err) {
  console.error('Storage error:', err.message);
}
