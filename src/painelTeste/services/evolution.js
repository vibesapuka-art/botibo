const axios = require('axios');

async function enviarWhatsapp(numero, texto) {
  if (!process.env.EVOLUTION_URL || !process.env.EVOLUTION_INSTANCE || !process.env.EVOLUTION_APIKEY) {
    console.log('⚠️ Evolution não configurada. Mensagem não enviada.');
    return false;
  }

  const url = `${process.env.EVOLUTION_URL}/message/sendText/${process.env.EVOLUTION_INSTANCE}`;

  await axios.post(
    url,
    {
      number: numero,
      text: texto
    },
    {
      headers: {
        'Content-Type': 'application/json',
        apikey: process.env.EVOLUTION_APIKEY
      },
      timeout: 45000
    }
  );

  return true;
}

module.exports = { enviarWhatsapp };
