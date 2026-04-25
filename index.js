const express = require('express');
const path = require('path');

// 1. AJUSTE DE IMPORTAÇÃO: 
// Você mencionou que seu arquivo de ativação se chama 'engine.js' e não 'activator.js'.
const engine = require('./src/bot/engine');   
const cleaner = require('./src/bot/cleaner'); 
const gestorBot = require('./src/bot/gestor'); 

const app = express();
app.use(express.json());

// 2. AJUSTE DE PASTA ESTÁTICA:
// Garanta que seu index.html esteja dentro de uma pasta chamada 'public'
app.use(express.static(path.join(__dirname, 'public')));

const statusPedidos = {};

// --- ROTA DE ATIVAÇÃO ---
app.post('/ativar', async (req, res) => {
    const pedido = req.body;
    if (!pedido.mac) return res.status(400).json({ error: "MAC é obrigatório" });
    
    const macId = pedido.mac.toLowerCase();
    
    // Inicializa o status
    statusPedidos[macId] = { 
        ...pedido, // Passamos os dados para o engine ler (user, pass, etc)
        status: "processando",
        mensagem: "Iniciando processamento...",
        tipo: "ibopro" // Necessário para o seu engine.js encontrar o pedido
    };

    // Cadastro no Gestor (Apenas se preenchido e se for novo)
    if (pedido.tipo === 'ativar' && pedido.nome && pedido.whatsapp) {
        statusPedidos[macId].mensagem = "Cadastrando no gestor...";
        gestorBot(pedido).catch(err => console.error("Erro Gestor:", err.message));
    }

    // Chama o seu ENGINE (ativador técnico)
    // Passamos como Array [statusPedidos[macId]] porque seu engine usa .find()
    statusPedidos[macId].mensagem = "Conectando ao IBO Pro...";
    engine([statusPedidos[macId]]).catch(err => {
        statusPedidos[macId].mensagem = "Erro técnico no motor.";
    });

    res.json({ success: true, message: "Processo iniciado" });
});

// --- ROTA DE LIMPEZA ---
app.post('/limpar', async (req, res) => {
    const pedido = req.body;
    if (!pedido.mac) return res.status(400).json({ error: "MAC é obrigatório" });

    const macId = pedido.mac.toLowerCase();
    statusPedidos[macId] = { mensagem: "Iniciando limpeza profunda..." };

    // Executa o cleaner que configuramos com o PIN 123321
    cleaner(statusPedidos[macId]).catch(err => {
        statusPedidos[macId].mensagem = "Erro ao executar limpeza.";
    });

    res.json({ success: true, message: "Limpeza iniciada" });
});

app.get('/status', (req, res) => {
    const mac = req.query.mac ? req.query.mac.toLowerCase() : null;
    if (mac && statusPedidos[mac]) {
        res.json(statusPedidos[mac]);
    } else {
        res.json({ mensagem: "Aguardando comando..." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em: http://localhost:${PORT}`);
});
