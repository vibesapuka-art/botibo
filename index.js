const express = require('express');
const path = require('path');

// Proteção para o servidor não cair se o arquivo do bot não for encontrado
let executarIboCom;
try {
    const botModule = require('./src/bot/bot_ibocom');
    executarIboCom = botModule.executarIboCom;
    console.log("✅ Módulo do robô carregado com sucesso.");
} catch (err) {
    console.error("❌ ERRO CRÍTICO: Não foi possível encontrar ./src/bot/bot_ibocom.js");
    console.error("Verifique se as pastas src e bot existem no seu GitHub.");
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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
    const { mac, tipo } = req.body;
    pedidos = pedidos.filter(p => p.mac !== mac);
    const novoPedido = { ...req.body, status: 'iniciando', mensagem: 'Iniciando...', captchaDigitado: null };
    pedidos.push(novoPedido);

    if (tipo === 'ibocom' && executarIboCom) {
        executarIboCom(novoPedido, atualizarStatus).catch(e => {
            atualizarStatus(mac, 'erro', 'Erro no robô: ' + e.message);
        });
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
    res.json(pedido || { status: 'aguardando', mensagem: 'Aguardando comando...' });
});

// Rota raiz para o Render saber que o app está vivo
app.get('/', (req, res) => res.send('Bot IBO Ativo!'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
