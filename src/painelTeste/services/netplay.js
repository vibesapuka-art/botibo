const axios = require('axios');

function limparWhatsapp(whatsapp) {
  let numero = String(whatsapp || '').replace(/\D/g, '');

  if (numero && !numero.startsWith('55') && numero.length <= 11) {
    numero = '55' + numero;
  }

  return numero;
}

async function gerarTesteNetplay({ nomeCliente, whatsapp, tipoTeste }) {
  const whatsappLimpo = limparWhatsapp(whatsapp);

  const urlNetplay =
    tipoTeste === 'com_adulto'
      ? process.env.NETPLAY_COM_ADULTO
      : process.env.NETPLAY_SEM_ADULTO;

  const resposta = await axios.post(
    urlNetplay,
    {
      appName: 'com.whatsapp',
      messageDateTime: Math.floor(Date.now() / 1000),
      devicePhone: process.env.DEVICE_PHONE || '5500000000000',
      deviceName: 'Painel Imperium',
      senderName: nomeCliente || 'Cliente Web',
      senderMessage:
        tipoTeste === 'com_adulto'
          ? 'Teste com adulto'
          : 'Teste sem adulto',
      senderPhone: whatsappLimpo,
      userAgent: 'Painel Imperium'
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Painel Imperium'
      },
      timeout: 20000
    }
  );

  return {
    whatsappLimpo,
    dados: resposta.data || {}
  };
}

module.exports = {
  gerarTesteNetplay,
  limparWhatsapp
};
