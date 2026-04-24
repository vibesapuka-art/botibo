const express = require('express');
const path = require('path');
const activator = require('./src/bot/activator');
const cleaner = require('./src/bot/cleaner');
const gestorBot = require('./src/bot/gestor'); // Bot que salva os dados do cliente

const app = express();
app.use(express.json());
app.use(express.static('public')); // Serve o seu index.html

// Banco de dados temporário para mensagens de status
const statusPedidos = {};

// --- ROTA DE ATIVAÇÃO (NOVO E ASSINANTE) ---
app.post('/ativar', async (req, res) => {
    const pedido = req.body;
    const macId = pedido.mac.toLowerCase();
    
    // Inicializa o objeto de status
    statusPedidos[macId] = { mensagem: "Iniciando processamento..." };

    // 1. Lógica do Gestor (Cadastro): Só ocorre no modo 'ativar'
    if (pedido.tipo === 'ativar' && pedido.nome && pedido.whatsapp) {
        statusPedidos[macId].mensagem = "Cadastrando cliente no gestor...";
        // Executa o bot do gestor em paralelo ou aguarda se for crítico
        gestorBot(pedido).catch(err => console.error("Erro Gestor:", err.message));
    }

    // 2. Lógica Técnica (Puppeteer no IBO Pro)
    // Passamos o objeto statusPedidos para o bot atualizar a mensagem em tempo real
    statusPedidos[macId].mensagem = "Conectando ao IBO Pro...";
    activator(pedido, statusPedidos[macId]);

    res.json({ success: true, message: "Processo iniciado" });
});

// --- ROTA DE LIMPEZA PROFUNDA ---
app.post('/limpar', async (req, res) => {
    const pedido = req.body;
    const macId = pedido.mac.toLowerCase();

    statusPedidos[macId] = { mensagem: "Iniciando limpeza..." };

    // Chama o cleaner que configuramos para localizar e excluir as listas
    cleaner(pedido, statusPedidos[macId]);

    res.json({ success: true, message: "Limpeza iniciada" });
});

// --- ROTA DE CONSULTA DE STATUS (O POLLING DO SEU HTML) ---
app.get('/status', (req, res) => {
    const mac = req.query.mac ? req.query.mac.toLowerCase() : null;
    if (mac && statusPedidos[mac]) {
        res.json(statusPedidos[mac]);
    } else {
        res.json({ mensagem: "Aguardando comando..." });
    }
});

// Inicialização do Servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor ATV DIGITAL rodando na porta ${PORT}`);
});
