const express = require('express');
const path = require('path');
const { executarIboCom } = require('./src/bot/bot_ibocom');

const app = express();
app.use(express.json());
app.use(express.static('public'));

let pedidos = [];

function atualizarStatus(mac, status, mensagem, extras = {}) {
    const pedido = pedidos.find(p => p.mac === mac);
    if (pedido) {
        pedido.status = status;
        pedido.mensagem = mensagem;
        Object.assign(pedido, extras);
    }
}

app.post('/ativar', (req, res) => {
    const { mac, key, tipo } = req.body;
    pedidos = pedidos.filter(p => p.mac !== mac);

    const novoPedido = { 
        mac, key, tipo, 
        status: 'iniciando', 
        mensagem: 'Conectando ao IBO...', 
        captchaDigitado: null 
    };
    pedidos.push(novoPedido);

    if (tipo === 'ibocom') {
        // Chamada da função exportada
        executarIboCom(novoPedido, atualizarStatus).catch(console.error);
    }

    res.json({ success: true });
});

app.post('/resolver-captcha', (req, res) => {
    const { mac, texto } = req.body;
    const pedido = pedidos.find(p => p.mac === mac);
    if (pedido) {
        pedido.captchaDigitado = texto;
        res.json({ success: true });
    } else {
        res.status(404).json({ error: "Sessão não encontrada" });
    }
});

app.get('/status', (req, res) => {
    const pedido = pedidos.find(p => p.mac === req.query.mac);
    res.json(pedido || { status: 'erro', mensagem: 'Aguardando...' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Servidor ativo na porta ${PORT}`));
