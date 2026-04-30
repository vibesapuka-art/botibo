const express = require('express');
const app = express();
const engine = require('./src/bot/engine');
const cleaner = require('./src/bot/cleaner');
// Importação correta do módulo de Webhook e Consulta
const { processarWebhook, consultarCliente } = require('./src/bot/webhook');

app.use(express.json());
app.use(express.static('public'));

let pedidos = [];
let processandoAgora = false;

// --- ROTAS DO WEBHOOK E ÁREA DO CLIENTE ---

// AJUSTE: Rota alterada para /webhook para coincidir com o seu teste e o padrão do Gestor
app.post('/webhook', processarWebhook);

// AJUSTE: Rota de consulta do site configurada para buscar no MongoDB
app.get('/api/cliente', async (req, res) => {
    const busca = req.query.id; 
    // Como o consultarCliente busca no MongoDB, ele precisa do 'await'
    const resultado = await consultarCliente(busca);

    if (resultado) {
        res.json({ success: true, dados: resultado });
    } else {
        res.json({ 
            success: false, 
            mensagem: "Cliente não localizado. Verifique os dados ou fale com o suporte." 
        });
    }
});

// --- FIM DAS NOVAS ROTAS ---

// 1. Recebe a solicitação e joga no FINAL da fila
app.post('/ativar', (req, res) => {
    const { mac, key, usuario, senha, tipo } = req.body;
    
    const novoPedido = {
        mac: mac.trim(),
        key: key.trim(),
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

// 2. Status da Fila
app.get('/status', (req, res) => {
    const macConsultado = req.query.mac;
    const indexAtual = pedidos.findIndex(p => p.mac === macConsultado);
    
    if (indexAtual !== -1) {
        const pedido = pedidos[indexAtual];
        const naFrente = indexAtual; 

        res.json({ 
            status: pedido.status, 
            mensagem: pedido.mensagem,
            naFrente: naFrente 
        });
    } else {
        res.json({ status: "erro", mensagem: "Pedido não encontrado." });
    }
});

// 3. Motor da Fila
async function gerenciarFila() {
    if (processandoAgora) {
        setTimeout(gerenciarFila, 3000);
        return;
    }

    const pedido = pedidos[0]; 

    if (!pedido) {
        setTimeout(gerenciarFila, 3000);
        return;
    }

    if (pedido.status === 'ok' || pedido.status === 'erro') {
        pedidos.shift(); 
        setTimeout(gerenciarFila, 1000);
        return;
    }

    processandoAgora = true;
    pedido.status = "processando";
    console.log(`🤖 Iniciando processo para o MAC: ${pedido.mac}`);

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
        console.log(`🏁 Finalizado MAC: ${pedido.mac}. Próximo da fila...`);
        gerenciarFila();
    }
}

gerenciarFila();

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Servidor Imperium TV Ativo na porta ${PORT}`));
