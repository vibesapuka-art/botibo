const express = require('express');
const path = require('path');

const engine = require('./src/bot/engine');
const cleaner = require('./src/bot/cleaner');
const enginegestor = require('./src/bot/enginegestor');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const statusPedidos = {};

app.post('/ativar', async (req, res) => {
    const dados = req.body;
    const macId = dados.mac.toLowerCase();
    
    // CORREÇÃO AQUI: Criamos as propriedades 'user' e 'pass' que o engine.js exige
    // para montar o link http://xw.pluss.fun/get.php?username=...
    statusPedidos[macId] = { 
        ...dados,
        user: dados.usuario, // Mapeia 'usuario' do formulário para 'user' do engine
        pass: dados.senha,   // Mapeia 'senha' do formulário para 'pass' do engine
        status: "processando", 
        tipo: "ibopro",
        mensagem: "Iniciando..." 
    };

    if (dados.tipo === 'ativar') {
        // Envia para o combo (Gestor + Ativação)
        enginegestor(statusPedidos[macId], statusPedidos[macId]);
    } else {
        // Envia apenas para ativação técnica
        engine([statusPedidos[macId]]);
    }

    res.json({ success: true });
});

app.post('/limpar', async (req, res) => {
    const dados = req.body;
    const macId = dados.mac.toLowerCase();
    statusPedidos[macId] = { ...dados, mensagem: "Limpando..." };
    cleaner(statusPedidos[macId], statusPedidos[macId]);
    res.json({ success: true });
});

app.get('/status', (req, res) => {
    const mac = req.query.mac ? req.query.mac.toLowerCase() : null;
    res.json(statusPedidos[mac] || { mensagem: "Aguardando..." });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor rodando e DNS corrigido`));
