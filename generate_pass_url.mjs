import { importPKCS8, SignJWT } from 'jose';
import fs from 'fs';

const sa = JSON.parse(fs.readFileSync('./functions/service-account-wallet.json', 'utf8'));
const key = await importPKCS8(sa.private_key, 'RS256');

const WALLET_ISSUER_ID = '3388000000023184117';
const lojaSlug = process.argv[2] || 'nox-dessert-club';
const lojaNome = process.argv[3] || 'Nox Dessert Club';
const selos = parseInt(process.argv[4] || '0', 10);
const premio = process.argv[5] || '1 Sobremesa Artesanal (10º Selo)';
const versao = 'v_' + Date.now();
const slugClean = lojaSlug.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
const classId = `${WALLET_ISSUER_ID}.${slugClean}_${versao}`;
const clienteId = '5511999998888';
const objectId = `${WALLET_ISSUER_ID}.${slugClean}_${clienteId}_c1`;

const heroBannerUri = selos === 0 
  ? 'https://mimo-fidelidade.web.app/banners/hero-0.jpg' 
  : (selos === 4 ? 'https://mimo-fidelidade.web.app/banners/hero-4.jpg' : `https://mimo-fidelidade.web.app/banners/hero-${selos}.jpg`);

const programLogoUri = (slugClean === 'nox_dessert_club' || slugClean === 'nox-dessert-club')
  ? 'https://mimo-fidelidade.web.app/logos/nox-dessert-club.jpg'
  : `https://mimo-fidelidade.web.app/logos/${slugClean}.jpg`;

const loyaltyClass = {
  id: classId,
  issuerName: lojaNome,
  programName: 'Programa de Fidelidade Digital',
  localizedIssuerName: { defaultValue: { language: 'pt-BR', value: lojaNome } },
  localizedProgramName: { defaultValue: { language: 'pt-BR', value: 'Programa de Fidelidade Digital' } },
  hexBackgroundColor: '#141416',
  accountNameLabel: 'CLIENTE VIP',
  accountIdLabel: 'CÓDIGO DO CARTÃO',
  rewardsTierLabel: 'STATUS',
  programLogo: {
    sourceUri: { uri: programLogoUri },
    contentDescription: { defaultValue: { language: 'pt-BR', value: `Logo ${lojaNome}` } }
  },
  heroImage: {
    sourceUri: { uri: heroBannerUri },
    contentDescription: { defaultValue: { language: 'pt-BR', value: `Cartela de Selos ${lojaNome}` } }
  },
  countryCode: 'BR',
  reviewStatus: 'UNDER_REVIEW',
  allowMultipleUsersPerObject: true,
  multipleDevicesAndHoldersAllowedStatus: 'multipleHolders'
};

const loyaltyObject = {
  id: objectId,
  classId: classId,
  state: 'ACTIVE',
  accountId: clienteId,
  accountName: 'Cliente VIP',
  loyaltyPoints: {
    localizedLabel: { defaultValue: { language: 'pt-BR', value: 'Cartão Mimo' } },
    balance: { string: `${selos} / 10 SELOS` }
  },
  heroImage: {
    sourceUri: { uri: heroBannerUri },
    contentDescription: { defaultValue: { language: 'pt-BR', value: `Progresso do Ciclo: ${selos} de 10 selos` } }
  },
  textModulesData: [
    {
      id: 'stamps_card',
      header: 'Stamps',
      body: 'Here you will see your of stamps'
    },
    {
      id: 'selos_card',
      header: 'Selos',
      body: `${selos}/10`
    },
    {
      id: 'cliente_vip',
      header: 'CLIENTE VIP',
      body: 'Cliente VIP'
    },
    {
      id: 'premio_mimo',
      header: 'PRÊMIO DO MIMO',
      body: premio
    },
    {
      id: 'email_cliente',
      header: 'E-MAIL CADASTRADO',
      body: 'cliente@exemplo.com'
    },
    {
      id: 'aniversario_cliente',
      header: 'DATA DE ANIVERSÁRIO',
      body: '01/01'
    },
    {
      id: 'celular_cliente',
      header: 'CELULAR / WHATSAPP',
      body: '(11) 99999-8888'
    },
    {
      id: 'progresso_ciclo',
      header: 'PROGRESSO DO CICLO',
      body: '0 de 10 selos acumulados (Faltam 10 selos)'
    },
    {
      id: 'status_cartao',
      header: 'STATUS DO CARTÃO',
      body: 'Ativo (Ciclo 1)'
    },
    {
      id: 'regras_resgate',
      header: 'INSTRUÇÃO DE RESGATE NO BALCÃO',
      body: 'Apresente o QR Code no balcão a cada compra para creditar o selo. Recompensa válida por 30 dias após completar os 10 selos.'
    },
    {
      id: 'leitura_qr',
      header: 'LEITURA DO QR CODE',
      body: 'O lojista lê este QR code para creditar o selo no caixa.'
    }
  ],
  infoModuleData: {
    labelValueRows: [
      {
        columns: [
          { label: 'CLIENTE VIP', value: 'Cliente VIP' },
          { label: 'STATUS', value: 'Ativo' }
        ]
      },
      {
        columns: [
          { label: 'E-MAIL', value: 'cliente@exemplo.com' },
          { label: 'ANIVERSÁRIO', value: '01/01' }
        ]
      },
      {
        columns: [
          { label: 'PROGRESSO', value: '0 / 10 SELOS' },
          { label: 'FALTAM', value: '10 selos' }
        ]
      }
    ]
  },
  barcode: {
    type: 'QR_CODE',
    value: `MIMO:${slugClean}_${clienteId}_1:123456`,
    alternateText: 'MIMO-PASS-8888'
  },
  linksModuleData: {
    uris: [
      { kind: 'walletobjects#uri', uri: 'https://mimo-fidelidade.web.app', description: 'Acessar Portal do Clube MIMO' },
      { kind: 'walletobjects#uri', uri: `https://mimo-fidelidade.web.app/c/${lojaSlug}`, description: 'Ver Minha Cartela & Regulamento' }
    ]
  }
};

const jwt = await new SignJWT({
  iss: sa.client_email,
  aud: 'google',
  typ: 'savetowallet',
  payload: {
    loyaltyClasses: [loyaltyClass],
    loyaltyObjects: [loyaltyObject]
  }
})
  .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
  .setIssuedAt()
  .sign(key);

const url = `https://pay.google.com/gp/v/save/${jwt}`;
console.log('CLASS_ID:' + classId);
console.log('SAVE_URL:' + url);
