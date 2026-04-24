const express = require('express');
const path = require('path');

// Importação dos seus módulos (certifique-se de que os nomes no GitHub estão em minúsculo)
const engine = require('./src/bot/engine');           // Apenas técnico (Assinante)
const cleaner = require('./src/bot/cleaner');         // Limpeza profunda
const enginegestor = require('./src/bot/enginegestor'); // Unificado (Novo)

const app = express();
app.use(express.json());

// Serve os arquivos da pasta public (onde deve estar seu index.html)
app.use(express.static(path.join(__dirname, 'public')));

// Banco de dados temporário para o status em tempo real
const statusPedidos = {};

// --- ROTA DE ATIVAÇÃO / CADASTRO ---
app.post('/ativar', async (req, res) => {
    const dados = req.body;
    if (!dados.mac) return res.status(400).json({ error: "MAC é obrigatório" });
    
    const macId = dados.mac.toLowerCase();
    
    // Prepara o objeto de status com as flags necessárias para o engine.js
    statusPedidos[macId] = { 
        ...dados, 
        status: "processando", 
        tipo: "ibopro",
        mensagem: "Iniciando sistema..." 
    };

    // DECISÃO DE FLUXO PARA ECONOMIA DE MEMÓRIA
    if (dados.tipo === 'ativar') {
        // MODO NOVO: Chama a "casinha única" que faz um por vez (Técnico -> Gestor)
        // Isso evita abrir 2 navegadores ao mesmo tempo no Render
        enginegestor(statusPedidos[macId], statusPedidos[macId]);
    } else {
        // MODO ASSINANTE: Vai direto para o motor técnico, pulando o gestor
        statusPedidos[macId].mensagem = "👤 Assinante identificado. Reativando lista...";
        engine([statusPedidos[macId]]);
    }

    res.json({ success: true, message: "Processamento iniciado com sucesso." });
});

// --- ROTA DE LIMPEZA PROFUNDA ---
app.post('/limpar', async (req, res) => {
    const dados = req.body;
    if (!dados.mac) return res.status(400).json({ error: "MAC é obrigatório" });

    const macId = dados.mac.toLowerCase();
    statusPedidos[macId] = { mensagem: "Limpando playlists (PIN: 123321)..." };

    // Chama o robô de limpeza
    cleaner(statusPedidos[macId]);

    res.json({ success: true, message: "Limpeza iniciada." });
});

// --- ROTA DE CONSULTA DE STATUS (POLLING) ---
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
    console.log(`
    =========================================
    🚀 ATV DIGITAL ONLINE
    📂 Modo: Híbrido (Novo / Assinante)
    🌐 Porta: ${PORT}
    =========================================
    `);
});
