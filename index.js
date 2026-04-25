const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());
app.use(express.static('public')); // Certifique-se que o index.html está na pasta 'public'

// Banco de dados temporário para mensagens de status
const statusPedidos = {};

// Função auxiliar para carregar módulos com segurança
const carregarModulo = (caminho) => {
    if (fs.existsSync(path.join(__dirname, caminho + '.js'))) {
        return require(caminho);
    }
    console.error(`⚠️ AVISO: O arquivo ${caminho}.js não foi encontrado!`);
    return null;
};

// Carregando os robôs (Ajuste os nomes se estiverem diferentes no seu GitHub)
const activator = carregarModulo('./src/bot/activator');
const cleaner = carregarModulo('./src/bot/cleaner');
const gestorBot = carregarModulo('./src/bot/gestor');

// --- ROTA DE ATIVAÇÃO ---
app.post('/ativar', async (req, res) => {
    const pedido = req.body;
    const macId = pedido.mac.toLowerCase();
    statusPedidos[macId] = { mensagem: "Iniciando..." };

    if (!activator) {
        return res.status(500).json({ error: "Módulo de ativação não configurado no servidor." });
    }

    if (pedido.tipo === 'ativar' && pedido.nome && gestorBot) {
        statusPedidos[macId].mensagem = "Cadastrando no gestor...";
        gestorBot(pedido).catch(e => console.log("Erro Gestor:", e.message));
    }

    statusPedidos[macId].mensagem = "Abrindo painel IBO...";
    activator(pedido, statusPedidos[macId]);
    res.json({ success: true });
});

// --- ROTA DE LIMPEZA ---
app.post('/limpar', async (req, res) => {
    const pedido = req.body;
    const macId = pedido.mac.toLowerCase();
    statusPedidos[macId] = { mensagem: "Iniciando limpeza..." };

    if (!cleaner) {
        return res.status(500).json({ error: "Módulo de limpeza não encontrado." });
    }

    cleaner(pedido, statusPedidos[macId]);
    res.json({ success: true });
});

app.get('/status', (req, res) => {
    const mac = req.query.mac ? req.query.mac.toLowerCase() : null;
    res.json(statusPedidos[mac] || { mensagem: "Aguardando..." });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Rodando na porta ${PORT}`));
