const express = require('express');
const cors = require('cors'); 
const app = express();

// IMPORTAÇÃO DA LISTA DE DNS
const listaDns = require('./src/config/dns.js');

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const engine = require('./src/bot/engine');
const cleaner = require('./src/bot/cleaner');
const { processarWebhook, consultarCliente } = require('./src/bot/webhook');

let pedidos = [];
let processandoAgora = false;

app.get('/api/cliente', async (req, res) => {
    const finalWhatsApp = req.query.id; 
    if (!finalWhatsApp) return res.json({ success: false, mensagem: "ID não fornecido." });

    try {
        const resultado = await consultarCliente(finalWhatsApp);
        if (resultado) {
            res.json({ success: true, dados: resultado });
        } else {
            res.json({ success: false, mensagem: "Número não localizado." });
        }
    } catch (error) {
        res.status(500).json({ success: false, mensagem: "Erro ao conectar com o banco." });
    }
});

app.post('/webhook', processarWebhook);

app.post('/ativar', (req, res) => {
    const { mac, key, usuario, senha, tipo } = req.body;
    const novoPedido = {
        mac: mac ? mac.trim() : "",
        key: key ? key.trim() : "",
        user: usuario,
        pass: senha,
        tipo: tipo,
        status: "pendente",
        mensagem: "⏳ AGUARDANDO NA FILA...",
        data: new Date()
    };
    pedidos = pedidos.filter(p => p.mac !== novoPedido.mac);
    pedidos.push(novoPedido);
    res.json({ success: true });
});

app.get('/status', (req, res) => {
    const macConsultado = req.query.mac;
    const indexAtual = pedidos.findIndex(p => p.mac === macConsultado);
    if (indexAtual !== -1) {
        const pedido = pedidos[indexAtual];
        res.json({ status: pedido.status, mensagem: pedido.mensagem, naFrente: indexAtual });
    } else {
        res.json({ status: "erro", mensagem: "Pedido não encontrado." });
    }
});

async function gerenciarFila() {
    if (processandoAgora || pedidos.length === 0) {
        setTimeout(gerenciarFila, 3000);
        return;
    }
    const pedido = pedidos[0];
    if (pedido.status === 'ok' || pedido.status === 'erro') {
        pedidos.shift();
        setTimeout(gerenciarFila, 1000);
        return;
    }
    processandoAgora = true;
    pedido.status = "processando";
    pedido.mensagem = "⚙️ PROCESSANDO NO SERVIDOR...";

    try {
        if (pedido.tipo === 'limpar') { 
            await cleaner(pedido); 
        } else { 
            await engine([pedido]); 
        }
        pedido.status = "ok";
        pedido.mensagem = "✅ FINALIZADO COM SUCESSO!";
    } catch (err) {
        pedido.status = "erro";
        pedido.mensagem = "❌ ERRO: " + err.message;
    } finally {
        processandoAgora = false;
        gerenciarFila();
    }
}

gerenciarFila();

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Servidor Imperium TV Ativo na porta ${PORT}`));
