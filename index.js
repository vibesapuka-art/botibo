const express = require('express');
const path = require('path');

// IMPORTANTE: Ajustei os nomes para baterem com os seus arquivos reais
const engine = require('./src/bot/engine'); // O seu arquivo de ativação
const cleaner = require('./src/bot/cleaner'); // O arquivo de limpeza que fizemos
const gestorBot = require('./src/bot/gestor'); // Seu bot de cadastro

const app = express();
app.use(express.json());
app.use(express.static('public')); 

const statusPedidos = {};

app.post('/ativar', async (req, res) => {
    const pedido = req.body;
    const macId = pedido.mac.toLowerCase();
    
    // Criamos a estrutura que o seu engine.js espera
    statusPedidos[macId] = { 
        ...pedido, 
        status: "pendente", 
        mensagem: "Iniciando...",
        tipo: "ibopro" // O seu engine.js filtra por esse tipo
    };

    // 1. Cadastro no Gestor (Se for novo)
    if (pedido.tipo === 'ativar' && pedido.nome) {
        gestorBot(pedido).catch(e => console.log("Erro Gestor:", e.message));
    }

    // 2. Executa o seu engine.js
    // Note que passamos um ARRAY porque o seu engine usa pedidos.find()
    engine([statusPedidos[macId]]);

    res.json({ success: true });
});

app.post('/limpar', async (req, res) => {
    const pedido = req.body;
    const macId = pedido.mac.toLowerCase();
    statusPedidos[macId] = { ...pedido, mensagem: "Limpando..." };

    // Chama o cleaner de exclusão
    cleaner(statusPedidos[macId]);

    res.json({ success: true });
});

app.get('/status', (req, res) => {
    const mac = req.query.mac ? req.query.mac.toLowerCase() : null;
    res.json(statusPedidos[mac] || { mensagem: "Aguardando..." });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 ATV DIGITAL online na porta ${PORT}`));
