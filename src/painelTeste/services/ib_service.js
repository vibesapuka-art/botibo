const ibEngine = require('./ib_engine');

async function adicionarPlaylistIb({
  mac,
  key,
  username,
  password,
  onUpdate
}) {
  const pedido = {
    status: 'processando',
    mac,
    key,
    user: username,
    pass: password,
    mensagem: 'Iniciando configuração do IB Player'
  };

  await ibEngine([pedido], {
    onUpdate
  });

  if (pedido.status !== 'ok') {
    throw new Error('Não foi possível configurar o IB Player.');
  }

  return {
    success: true,
    mensagem: pedido.mensagem
  };
}

module.exports = {
  adicionarPlaylistIb
};
