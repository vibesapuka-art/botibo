const express = require('express');
const path = require('path');

// Importa o engine exatamente como está no seu repositório
let executarIboPro;
try {
    executarIboPro = require('./src/bot/engine');
    console.log("✅ Engine IBO PRO carregado com sucesso.");
} catch (e) {
    console.error("❌ Erro ao carregar o arquivo engine.js:", e.message);
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let pedidos = [];

// Função de status simplificada para o IBO PRO
async function atualizarStatus(mac, status, mensagem, extras = {}) {
    const pedido = pedidos.find(p => p.mac === mac);
    if (pedido) {
        pedido.status = status;
        pedido.mensagem = mensagem;
        Object.assign(pedido, extras);
        console.log(`[${mac}] Status: ${status} - ${mensagem}`);
    }
}

app.post('/ativar', (req, res) => {
    const { mac } = req.body;
    
    // Limpa histórico do MAC anterior
    pedidos = pedidos.filter(p => p.mac !== mac);
    
    const novoPedido = { 
        ...req.body, 
        status: 'iniciando', 
        mensagem: 'Iniciando robô IBO PRO...',
        tipo: 'ibopro' // Garante que o engine encontre o pedido
    };
    pedidos.push(novoPedido);

    if (typeof executarIboPro === 'function') {
        // Passa o array de pedidos como o seu engine.js espera
        executarIboPro(pedidos).catch(e => {
            atualizarStatus(mac, 'erro', 'Erro no processamento: ' + e.message);
        });
        res.json({ success: true });
    } else {
        res.status(500).json({ error: "Módulo Engine não disponível." });
    }
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
    res.json(pedido || { status: 'aguardando', mensagem: 'Aguardando...' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor IBO PRO rodando na porta ${PORT}`);
});
