const express = require('express');
const path = require('path');
const executarBot = require('./bot'); // Importa a função do bot.js
const app = express();

app.use(express.json());
app.use(express.static('public'));

let pedidos = [];

// Rota para receber o formulário
app.post('/ativar', (req, res) => {
    const { mac, key, user, pass } = req.body;
    const m3u = `http://dns-exemplo.com:80/get.php?username=${user}&password=${pass}&type=m3u_plus&output=ts`;
    
    const novoPedido = { mac, key, m3u, status: "pendente", concluidos: 0, total: 15 };
    pedidos.push(novoPedido);
    res.json({ msg: "Pedido recebido" });
});

// Rota para o index.html consultar o progresso
app.get('/status', (req, res) => {
    const pedido = pedidos.find(p => p.mac === req.query.mac);
    res.json(pedido || { status: "nao_encontrado" });
});

// Loop que chama o bot constantemente
setInterval(() => {
    executarBot(pedidos);
}, 5000);

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));
