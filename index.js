const express = require('express');
const path = require('path');

const engine = require('./src/bot/engine');           
const cleaner = require('./src/bot/cleaner');         
const enginegestor = require('./src/bot/enginegestor'); 

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const statusPedidos = {};

// --- ROTA DE ATIVAÇÃO / CADASTRO ---
app.post('/ativar', async (req, res) => {
    const dados = req.body;
    const macId = dados.mac.toLowerCase();
    
    statusPedidos[macId] = { 
        ...dados, 
        status: "processando", 
        tipo: "ibopro",
        mensagem: "Iniciando..." 
    };

    if (dados.tipo === 'ativar') {
        // Envia o objeto individual e o status para o combo
        enginegestor(statusPedidos[macId], statusPedidos[macId]);
    } else {
        // O seu engine.js ESPECIFICAMENTE exige um Array [ ]
        engine([statusPedidos[macId]]);
    }

    res.json({ success: true });
});

// --- ROTA DE LIMPEZA (ONDE DEU O ERRO) ---
app.post('/limpar', async (req, res) => {
    const dados = req.body;
    const macId = dados.mac.toLowerCase();

    // Criamos o objeto de status
    statusPedidos[macId] = { 
        ...dados,
        mensagem: "Buscando playlists para limpar..." 
    };

    // CORREÇÃO: O cleaner geralmente espera o objeto direto, 
    // mas se ele usar a mesma lógica do engine, ele precisa de um Array.
    // Vamos enviar o objeto direto conforme a estrutura padrão do cleaner.
    try {
        cleaner(statusPedidos[macId], statusPedidos[macId]);
    } catch (e) {
        console.error("Erro ao chamar cleaner:", e.message);
        statusPedidos[macId].mensagem = "❌ Erro ao iniciar limpeza.";
    }

    res.json({ success: true });
});

app.get('/status', (req, res) => {
    const mac = req.query.mac ? req.query.mac.toLowerCase() : null;
    res.json(statusPedidos[mac] || { mensagem: "Aguardando..." });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));
