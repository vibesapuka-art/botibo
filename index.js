const express = require('express');
const cors = require('cors'); // Para permitir que o site consulte o servidor
const app = express();

// Ativa as permissões de acesso
app.use(cors());

const engine = require('./src/bot/engine');
const cleaner = require('./src/bot/cleaner');
const { processarWebhook, consultarCliente } = require('./src/bot/webhook');

app.use(express.json());
app.use(express.static('public'));

let pedidos = [];
let processandoAgora = false;

// --- ROTAS DE INTEGRAÇÃO GESTORV3 ---

// Recebe dados do GestorV3 (webhook)
app.post('/webhook', processarWebhook);

// Rota de consulta do Painel (Front-end)
app.get('/api/cliente', async (req, res) => {
    const busca = req.query.id; 
    try {
        const resultado = await consultarCliente(busca);
        if (resultado) {
            res.json({ success: true, dados: resultado });
        } else {
            res.json({ 
                success: false, 
                mensagem: "Cliente não localizado. Verifique o número ou fale com o suporte." 
            });
        }
    } catch (error) {
        res.status(500).json({ success: false, mensagem: "Erro ao consultar banco de dados." });
    }
});

// --- FIM DAS ROTAS DE INTEGRAÇÃO ---

// 1. Recebe a solicitação de ativação e joga na fila
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

// 3. Motor de Processamento (Fila)
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
