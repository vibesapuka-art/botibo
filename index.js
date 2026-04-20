const express = require('express');
const path = require('path');

// Módulos dos robôs
let executarIboCom;
let adicionarPlaylistIbo; // Novo robô

try {
    const botLogin = require('./src/bot/bot_ibocom');
    const botPlaylist = require('./src/bot/bot_ibom_playlist');
    
    executarIboCom = botLogin.executarIboCom;
    adicionarPlaylistIbo = botPlaylist.adicionarPlaylistIbo;
    
    console.log("✅ Módulos do robô IBO carregados.");
} catch (err) {
    console.error("❌ Erro ao carregar módulos. Verifique se os arquivos existem em ./src/bot/");
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let pedidos = [];

// Função de status melhorada para encadear os robôs
async function atualizarStatus(mac, status, mensagem, extras = {}) {
    const pedido = pedidos.find(p => p.mac === mac);
    if (pedido) {
        pedido.status = status;
        pedido.mensagem = mensagem;
        Object.assign(pedido, extras);

        // PONTE AUTOMÁTICA: Se o login deu OK, chama o bot de Playlist
        if (status === 'ok' && mensagem.includes("Logado com sucesso") && pedido.tipo === 'ibocom') {
            console.log(`Iniciando segunda etapa para MAC: ${mac}`);
            // Chamamos o bot de playlist sem travar o servidor
            adicionarPlaylistIbo(pedido, atualizarStatus).catch(e => {
                atualizarStatus(mac, 'erro', 'Erro na Playlist: ' + e.message);
            });
        }
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
    // O IBO Pro ou outros tipos continuam funcionando normalmente aqui sem mudanças
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

app.get('/', (req, res) => res.send('Bot IBO Ativo!'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
