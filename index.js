const express = require('express');
const cors = require('cors'); 
const app = express();

// Libera o acesso para o seu site no Render não dar erro de conexão
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const engine = require('./src/bot/engine');
const cleaner = require('./src/bot/cleaner');
const { processarWebhook, consultarCliente } = require('./src/bot/webhook');

// --- ROTA DE PESQUISA POR WHATSAPP ---

app.get('/api/cliente', async (req, res) => {
    // O 'id' aqui é o número que o cliente digita no campo do site
    const whatsappDigitado = req.query.id; 
    
    if (!whatsappDigitado) {
        return res.json({ success: false, mensagem: "Digite um número de WhatsApp." });
    }

    try {
        // Chama a função que busca no MongoDB pelo campo 'whatsapp'
        const resultado = await consultarCliente(whatsappDigitado);

        if (resultado) {
            // Se achou, manda os dados do Jefferson para o site
            res.json({ success: true, dados: resultado });
        } else {
            res.json({ 
                success: false, 
                mensagem: "Número não encontrado. Verifique se digitou com o DDD." 
            });
        }
    } catch (error) {
        res.status(500).json({ success: false, mensagem: "Erro ao acessar o banco de dados." });
    }
});

// --- RESTANTE DAS ROTAS (FILA E WEBHOOK) ---

app.post('/webhook', processarWebhook);

app.post('/ativar', (req, res) => {
    const { mac, key, usuario, senha, tipo } = req.body;
    const novoPedido = {
        mac: mac ? mac.trim() : "",
        key: key ? key.trim() : "",
        user: usuario, pass: senha, tipo: tipo,
        status: "pendente", mensagem: "⏳ NA FILA...", data: new Date()
    };
    pedidos.push(novoPedido);
    res.json({ success: true });
});

let pedidos = [];
let processandoAgora = false;

async function gerenciarFila() {
    if (processandoAgora || pedidos.length === 0) { setTimeout(gerenciarFila, 3000); return; }
    const pedido = pedidos[0];
    if (pedido.status === 'ok' || pedido.status === 'erro') { pedidos.shift(); gerenciarFila(); return; }
    processandoAgora = true;
    pedido.status = "processando";
    try {
        if (pedido.tipo === 'limpar') await cleaner(pedido);
        else await engine([pedido]);
        pedido.status = "ok";
    } catch (err) { pedido.status = "erro"; }
    finally { processandoAgora = false; gerenciarFila(); }
}
gerenciarFila();

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Servidor Imperium TV Ativo na porta ${PORT}`));
