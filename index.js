const express = require('express');
const path = require('path');

// Importação dos robôs
let executarIboPro; // Robô antigo
let executarIboCom; // Robô novo (Login)
let adicionarPlaylistIbo; // Robô novo (Playlist)

try {
    // Verifique se os nomes dos arquivos estão corretos no seu GitHub
    executarIboPro = require('./src/bot/bot_ibopro').executarIboPro; 
    const botLogin = require('./src/bot/bot_ibocom');
    const botPlaylist = require('./src/bot/bot_ibom_playlist');
    
    executarIboCom = botLogin.executarIboCom;
    adicionarPlaylistIbo = botPlaylist.adicionarPlaylistIbo;
    
    console.log("✅ Todos os módulos carregados com sucesso.");
} catch (err) {
    console.error("❌ Erro ao carregar módulos:", err.message);
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let pedidos = [];

// Função que gerencia o status e o encadeamento dos bots
async function atualizarStatus(mac, status, mensagem, extras = {}) {
    const pedido = pedidos.find(p => p.mac === mac);
    if (pedido) {
        pedido.status = status;
        pedido.mensagem = mensagem;
        Object.assign(pedido, extras);

        // ENCADERAMENTO: Só dispara a playlist se for o bot 'ibocom' e o login der OK
        if (status === 'ok' && mensagem.includes("Logado com sucesso") && pedido.tipo === 'ibocom') {
            console.log(`[Fluxo] Login OK. Iniciando Playlist para MAC: ${mac}`);
            adicionarPlaylistIbo(pedido, atualizarStatus).catch(e => {
                atualizarStatus(mac, 'erro', 'Erro na Playlist: ' + e.message);
            });
        }
    }
}

app.post('/ativar', (req, res) => {
    const { mac, tipo } = req.body;
    
    // Limpa pedidos antigos do mesmo MAC para evitar conflito
    pedidos = pedidos.filter(p => p.mac !== mac);
    
    const novoPedido = { 
        ...req.body, 
        status: 'iniciando', 
        mensagem: 'Iniciando robô...', 
        captchaDigitado: null 
    };
    pedidos.push(novoPedido);

    // Lógica para decidir qual robô rodar
    if (tipo === 'ibopro' && executarIboPro) {
        console.log("🤖 Iniciando IBO PRO...");
        executarIboPro(novoPedido, atualizarStatus).catch(e => {
            atualizarStatus(mac, 'erro', 'Erro IBO PRO: ' + e.message);
        });
    } 
    else if (tipo === 'ibocom' && executarIboCom) {
        console.log("🤖 Iniciando IBO PLAYER...");
        executarIboCom(novoPedido, atualizarStatus).catch(e => {
            atualizarStatus(mac, 'erro', 'Erro IBO PLAYER: ' + e.message);
        });
    }

    res.json({ success: true });
});

// ... (Resto do código: resolver-captcha, status, listen)
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

app.get('/', (req, res) => res.send('Servidor Ativo!'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Online na porta ${PORT}`));
