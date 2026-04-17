const express = require('express');
const executarBot = require('./bot');
const app = express();

app.use(express.json());
app.use(express.static('public'));

let pedidos = [];
let botOcupado = false;

app.post('/ativar', (req, res) => {
    const { mac, key, user, pass } = req.body;
    // Limpa pedidos antigos do mesmo MAC para evitar conflito
    pedidos = pedidos.filter(p => p.mac !== mac);
    
    pedidos.push({
        mac, key, user, pass,
        status: "pendente",
        concluidos: 0,
        total: 15
    });
    res.json({ success: true });
});

app.get('/status', (req, res) => {
    const pedido = pedidos.find(p => p.mac === req.query.mac);
    res.json(pedido || { status: "nao_encontrado" });
});

// Loop controlado para não sobrecarregar o processador do Render
setInterval(async () => {
    if (botOcupado) return;
    botOcupado = true;
    try {
        await executarBot(pedidos);
    } catch (e) {
        console.log("Erro no loop principal");
    }
    botOcupado = false;
}, 8000);

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Servidor na porta ${PORT}`));
