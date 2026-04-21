const express = require('express');
const path = require('path');

// Variáveis para os robôs
let executarIboPro; 
let executarIboCom; 
let adicionarPlaylistIbo; 

// --- BLOCO DE CARREGAMENTO CRÍTICO ---
try {
    // Tenta carregar o IBO PRO (Ajuste o nome 'engine' se o seu arquivo for outro)
    const engineModule = require('./src/bot/engine'); 
    executarIboPro = engineModule.executarIboPro;
    console.log("✅ IBO PRO (Engine) carregado.");
} catch (e) {
    console.error("❌ ERRO: Arquivo './src/bot/engine.js' não encontrado ou função 'executarIboPro' não exportada.");
}

try {
    const botLogin = require('./src/bot/bot_ibocom');
    const botPlaylist = require('./src/bot/bot_ibom_playlist');
    executarIboCom = botLogin.executarIboCom;
    adicionarPlaylistIbo = botPlaylist.adicionarPlaylistIbo;
    console.log("✅ IBO Player (Login e Playlist) carregado.");
} catch (e) {
    console.error("❌ ERRO: Módulos do IBO Player não encontrados em ./src/bot/");
}
// -------------------------------------

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

        // Disparo automático da playlist para IBO Player
        if (status === 'ok' && mensagem.includes("Logado com sucesso") && pedido.tipo === 'ibocom') {
            adicionarPlaylistIbo(pedido, atualizarStatus).catch(err => {
                atualizarStatus(mac, 'erro', 'Erro Playlist: ' + err.message);
            });
        }
    }
}

app.post('/ativar', (req, res) => {
    const { mac, tipo } = req.body;
    pedidos = pedidos.filter(p => p.mac !== mac);
    
    const novoPedido = { ...req.body, status: 'iniciando', mensagem: 'Iniciando robô...', captchaDigitado: null };
    pedidos.push(novoPedido);

    if (tipo === 'ibopro') {
        if (executarIboPro) {
            console.log("🤖 Iniciando Engine...");
            executarIboPro(novoPedido, atualizarStatus).catch(e => atualizarStatus(mac, 'erro', e.message));
        } else {
            atualizarStatus(mac, 'erro', 'Módulo Engine não carregado no servidor.');
        }
    } 
    else if (tipo === 'ibocom' && executarIboCom) {
        executarIboCom(novoPedido, atualizarStatus).catch(e => atualizarStatus(mac, 'erro', e.message));
    }

    res.json({ success: true });
});

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
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Servidor na porta ${PORT}`));
