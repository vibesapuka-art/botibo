const express = require('express');
const path = require('path');
// Importa a função do robô (certifica-te que o caminho do ficheiro está correto)
const { executarIboCom } = require('./src/bot/bot_ibocom');

const app = express();

// Configurações do Express
app.use(express.json());
app.use(express.static('public')); // Para servir o teu index.html e imagens

// Base de dados temporária em memória para os pedidos
let pedidos = [];

/**
 * Função para atualizar o estado de um pedido
 * @param {string} mac - O endereço MAC do dispositivo
 * @param {string} status - O novo status (ex: 'aguardando_captcha', 'ok', 'erro')
 * @param {string} mensagem - Mensagem amigável para o utilizador
 * @param {object} extras - Dados adicionais (como a imagem do captcha em base64)
 */
function atualizarStatus(mac, status, mensagem, extras = {}) {
    const pedido = pedidos.find(p => p.mac === mac);
    if (pedido) {
        pedido.status = status;
        pedido.mensagem = mensagem;
        // Mescla dados extras (como o captchaBase64) no objeto do pedido
        Object.assign(pedido, extras);
        console.log(`[Status ${mac}]: ${status} - ${mensagem}`);
    }
}

// ROTA: Iniciar a ativação
app.post('/ativar', (req, res) => {
    const { mac, key, user, pass, tipo } = req.body;

    if (!mac) {
        return res.status(400).json({ error: "MAC é obrigatório" });
    }

    // Cria ou atualiza o pedido na lista
    let pedido = pedidos.find(p => p.mac === mac);
    if (!pedido) {
        pedido = { mac, key, user, pass, tipo, status: 'iniciando', mensagem: 'Preparando robô...', captchaDigitado: null };
        pedidos.push(pedido);
    } else {
        // Reinicia o pedido se ele já existia
        pedido.status = 'iniciando';
        pedido.mensagem = 'Reiniciando processo...';
        pedido.captchaDigitado = null;
    }

    // Dispara o robô específico conforme a seleção do painel
    if (tipo === 'ibocom') {
        // Chama o bot que lida com o site .com (com captcha)
        executarIboCom(pedido, atualizarStatus);
    } else {
        // Aqui chamarias o teu bot do IBO PRO (caso tenhas um ficheiro separado)
        // executarIboPro(pedido, atualizarStatus);
        atualizarStatus(mac, 'erro', 'Bot IBO PRO não configurado neste ficheiro.');
    }

    res.json({ success: true, message: "Processo iniciado" });
});

// ROTA: Receber a solução do captcha vinda do cliente
app.post('/resolver-captcha', (req, res) => {
    const { mac, texto } = req.body;
    const pedido = pedidos.find(p => p.mac === mac);

    if (pedido) {
        pedido.captchaDigitado = texto; // O robô que está em loop vai ler este valor
        res.json({ success: true });
    } else {
        res.status(404).json({ error: "Pedido não encontrado" });
    }
});

// ROTA: Consultar o status (o teu HTML chama esta rota a cada 3 segundos)
app.get('/status', (req, res) => {
    const mac = req.query.mac;
    const pedido = pedidos.find(p => p.mac === mac);

    if (pedido) {
        res.json(pedido);
    } else {
        res.json({ status: 'erro', mensagem: 'MAC não encontrado no servidor.' });
    }
});

// Inicia o servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(`Servidor de Ativação Digital Ativo!`);
    console.log(`Porta: ${PORT}`);
    console.log(`=========================================`);
});
