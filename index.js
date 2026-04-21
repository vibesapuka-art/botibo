const express = require('express');
const path = require('path');

// Importação dos robôs
let executarIboPro; 
let executarIboCom; 
let adicionarPlaylistIbo; 

// --- CARREGAMENTO DOS MÓDULOS ---
try {
    // Como o seu engine.js exporta a função direto, importamos assim:
    executarIboPro = require('./src/bot/engine'); 
    console.log("✅ IBO PRO (Engine.js) carregado com sucesso.");
} catch (e) {
    console.error("❌ ERRO ao carregar engine.js:", e.message);
}

try {
    const botLogin = require('./src/bot/bot_ibocom');
    const botPlaylist = require('./src/bot/bot_ibom_playlist');
    executarIboCom = botLogin.executarIboCom;
    adicionarPlaylistIbo = botPlaylist.adicionarPlaylistIbo;
    console.log("✅ Módulos IBO Player carregados.");
} catch (e) {
    console.error("❌ ERRO nos módulos IBO Player:", e.message);
}
// --------------------------------

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let pedidos = [];

async function atualizarStatus(mac, status, mensagem, extras = {}) {
    const pedido = pedidos.find(p => p.mac === mac);
    if (pedido) {
        pedido.status = status;
        pedido.mensagem = mensagem;
        Object.assign(pedido, extras);

        // Fluxo automático para IBO Player (login -> playlist)
        if (status === 'ok' && mensagem.includes("Logado com sucesso") && pedido.tipo === 'ibocom') {
            adicionarPlaylistIbo(pedido, atualizarStatus).catch(err => {
                atualizarStatus(mac, 'erro', 'Erro na Playlist: ' + err.message);
            });
        }
    }
}

app.post('/ativar', (req, res) => {
    const { mac, tipo } = req.body;
    pedidos = pedidos.filter(p => p.mac !== mac);
    
    const novoPedido = { 
        ...req.body, 
        status: 'iniciando', 
        mensagem: 'Iniciando robô...', 
        captchaDigitado: null 
    };
    pedidos.push(novoPedido);

    if (tipo === 'ibopro') {
        if (typeof executarIboPro === 'function') {
            console.log("🤖 Rodando Engine IBO PRO...");
            // O seu engine.js recebe a lista de pedidos, passamos o array
            executarIboPro(pedidos).catch(e => {
                atualizarStatus(mac, 'erro', 'Erro no Engine: ' + e.message);
            });
        } else {
            atualizarStatus(mac, 'erro', 'Módulo Engine não é uma função.');
        }
    } 
    else if (tipo === 'ibocom' && executarIboCom) {
        executarIboCom(novoPedido, atualizarStatus).catch(e => {
            atualizarStatus(mac, 'erro', 'Erro IBO Player: ' + e.message);
        });
    }

    res.json({ success: true });
});

// Rotas auxiliares
app.post('/resolver-captcha', (req, res) => {
    const pedido = pedidos.find(p => p.mac === req.body.mac);
    if (pedido) {
        pedido.captchaDigitado = req.body.texto;
        res.json({ success: true });
    }
});

app.get('/status', (req, res) => {
    const pedido = pedidos.find(p => p.mac === req.query.mac);
    res.json(pedido || { status: 'aguardando', mensagem: 'Aguardando comando...' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Online na porta ${PORT}`));
