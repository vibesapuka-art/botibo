const { MongoClient } = require('mongodb');

const uri = process.env.MONGO_URL;
const DB_NAME = 'ImperiumDB';
const COLLECTION_NAME = 'testes_ib';

function limparMac(mac) {
  return String(mac || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-F0-9]/g, '');
}

async function verificarMacJaUsouTeste(mac) {
  if (!uri) {
    throw new Error('MONGO_URL não configurada.');
  }

  const macLimpo = limparMac(mac);

  if (!macLimpo) {
    return null;
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();

    const db = client.db(DB_NAME);
    const colecao = db.collection(COLLECTION_NAME);

    return await colecao.findOne({
      mac_normalizado: macLimpo
    });

  } finally {
    await client.close();
  }
}

async function salvarTesteIb({
  nomeCliente,
  whatsapp,
  mac,
  key,
  tipoTeste,
  username,
  password,
  validade,
  status = 'gerado'
}) {
  if (!uri) {
    throw new Error('MONGO_URL não configurada.');
  }

  const macLimpo = limparMac(mac);
  const whatsappLimpo = String(whatsapp || '').replace(/\D/g, '');

  const client = new MongoClient(uri);

  try {
    await client.connect();

    const db = client.db(DB_NAME);
    const colecao = db.collection(COLLECTION_NAME);

    await colecao.updateOne(
      { mac_normalizado: macLimpo },
      {
        $setOnInsert: {
          mac_normalizado: macLimpo,
          mac_original: mac,
          key_original: key,
          whatsapp: whatsappLimpo,
          nomeCliente: nomeCliente || 'Cliente Imperium',
          tipoTeste: tipoTeste || 'sem_adulto',
          username,
          password,
          validade,
          status,
          criadoEm: new Date()
        }
      },
      { upsert: true }
    );

    return true;

  } finally {
    await client.close();
  }
}

module.exports = {
  limparMac,
  verificarMacJaUsouTeste,
  salvarTesteIb
};
