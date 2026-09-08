const { GoogleAuth } = require('google-auth-library');
const jwt = require('jsonwebtoken');

const ISSUER_ID = process.env.WALLET_ISSUER_ID || '3388000000012345678';

const SA = () => {
  if (process.env.WALLET_SA_KEY) {
    try {
      return JSON.parse(process.env.WALLET_SA_KEY);
    } catch (e) {
      console.warn('WALLET_SA_KEY parse error:', e.message);
    }
  }
  // Fallback mock credentials for dev/demo testing before Google Issuer console approval
  return {
    client_email: 'mimo-wallet-issuer@mimo-2d6eb.iam.gserviceaccount.com',
    private_key: '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA0mockkey...\n-----END RSA PRIVATE KEY-----\n'
  };
};

const BASE = 'https://walletobjects.googleapis.com/walletobjects/v1';

async function client() {
  const auth = new GoogleAuth({
    credentials: SA(),
    scopes: ['https://www.googleapis.com/auth/wallet_object.issuer'],
  });
  return auth.getClient();
}

async function api(method, path, body) {
  try {
    const c = await client();
    const res = await c.request({ url: `${BASE}${path}`, method, data: body });
    return res.data;
  } catch (error) {
    console.error(`Google Wallet API [${method} ${path}] failed:`, error.response?.data || error.message);
    throw error;
  }
}

module.exports = {
  api,
  ISSUER_ID,
  SA,
  jwt
};
