const express = require('express');
const path = require('path');

// Importação dos bots especializados
const engine = require('./src/bot/engine');           // Apenas técnico
const cleaner = require('./src/bot/cleaner');         // Limpeza profunda
const enginegestor = require('./src/bot/enginegestor'); // Combo Novo Cliente

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const statusPedidos = {};

app.post('/ativar', async (req, res) => {
    const dados = req.body;
    const macId = dados.mac.toLowerCase();
    
    // Inicializa o status para o Front-end
    statusPedidos[macId] = { 
        ...dados, 
        status: "processando", 
        tipo: "ibopro",
        mensagem: "Preparando motores..." 
    };

    // DECISÃO DE FLUXO
    if (dados.tipo === 'ativar') {
        // ÁREA NOVO: Ativa o bot unificado (Gestor + Lista)
        enginegestor(statusPedidos[macId], statusPedidos[macId]);
    } else {
        // ÁREA ASSINANTE: Ativa apenas o motor técnico (engine.js)
        statusPedidos[macId].mensagem = "👤 Reconhecido como assinante. Reativando...";
        engine([statusPedidos[macId]]);
    }

    res.json({ success: true });
});

app.post('/limpar', async (req, res) => {
    const dados = req.body;
    const macId = dados.mac.toLowerCase();
    statusPedidos[macId] = { mensagem: "Iniciando limpeza..." };
    
    // Chama o robô de exclusão que configuramos
    cleaner(statusPedidos[macId]);
    res.json({ success: true });
});

app.get('/status', (req, res) => {
    const mac = req.query.mac ? req.query.mac.toLowerCase() : null;
    res.json(statusPedidos[mac] || { mensagem: "Aguardando..." });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 ATV DIGITAL: Sistema Híbrido Ativo`));
