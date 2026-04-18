const express = require('express');
const queue = require('./src/services/queue');
const engine = require('./src/bot/engine');
const app = express();

app.use(express.json());
app.use(express.static('public'));

// Rota para receber o pedido do site
app.post('/ativar', (req, res) => {
    queue.adicionarPedido(req.body);
    res.json({ success: true });
});

// Rota para o frontend consultar o progresso
app.get('/status', (req, res) => {
    const pedido = queue.buscarPedido(req.query.mac);
    res.json(pedido || { status: "nao_encontrado" });
});

// Loop do Bot
let botOcupado = false;
setInterval(async () => {
    if (botOcupado) return;
    botOcupado = true;
    try {
        await engine(queue.getFilaCompleta());
    } catch (e) {
        console.log("Erro no loop principal:", e.message);
    }
    botOcupado = false;
}, 8000);

app.listen(10000, () => console.log("Servidor rodando na porta 10000"));
