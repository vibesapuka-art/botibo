const express = require('express');
const path = require('path');

// Importação dos robôs com nomes de arquivos REAIS
let executarIboPro; 
let executarIboCom; 
let adicionarPlaylistIbo; 

try {
    // AJUSTE AQUI: Se o seu arquivo do IBO PRO se chama engine.js, use o caminho abaixo
    const moduloIboPro = require('./src/bot/engine'); // Certifique-se que o nome é engine.js
    executarIboPro = moduloIboPro.executarIboPro; 

    const botLogin = require('./src/bot/bot_ibocom');
    const botPlaylist = require('./src/bot/bot_ibom_playlist');
    
    executarIboCom = botLogin.executarIboCom;
    adicionarPlaylistIbo = botPlaylist.adicionarPlaylistIbo;
    
    console.log("✅ Todos os módulos (incluindo Engine) carregados.");
} catch (err) {
    console.error("❌ Erro ao carregar módulos. Verifique os nomes dos arquivos!");
    console.error("Detalhe do erro:", err.message);
}

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

        // Fluxo automático para IBO Player (ibocom)
        if (status === 'ok' && mensagem.includes("Logado com sucesso") && pedido.tipo === 'ibocom') {
            adicionarPlaylistIbo(pedido, atualizarStatus).catch(e => {
                atualizarStatus(mac, 'erro', 'Erro na Playlist: ' + e.message);
            });
        }
    }
}

app.post('/ativar', (req, res) => {
    const { mac, tipo } = req.body;
    pedidos = pedidos.filter(p => p.mac !== mac);
    
    const novoPedido = { ...req.body, status: 'iniciando', mensagem: 'Iniciando robô...', captchaDigitado: null };
    pedidos.push(novoPedido);

    // Chama o Engine para IBO PRO
    if (tipo === 'ibopro' && executarIboPro) {
        console.log("🤖 Rodando Engine (IBO PRO)...");
        executarIboPro(novoPedido, atualizarStatus).catch(e => {
            atualizarStatus(mac, 'erro', 'Erro no Engine: ' + e.message);
        });
    } 
    // Chama o Bot IBOCOM
    else if (tipo === 'ibocom' && executarIboCom) {
        console.log("🤖 Rodando IBO Player...");
        executarIboCom(novoPedido, atualizarStatus).catch(e => {
            atualizarStatus(mac, 'erro', 'Erro IBO Player: ' + e.message);
        });
    }

    res.json({ success: true });
});

// ... rotas de captcha e status continuam iguais ...
app.post('/resolver-captcha', (req, res) => {
    const { mac, texto } = req.body;
    const pedido = pedidos.find(p => p.mac === mac);
    if (pedido) {
        pedido.captchaDigitado = texto;
        res.json({ success: true });
    }
});

app.get('/status', (req, res) => {
    const pedido = pedidos.find(p => p.mac === req.query.mac);
    res.json(pedido || { status: 'aguardando', mensagem: 'Aguardando...' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Porta ${PORT}`));
