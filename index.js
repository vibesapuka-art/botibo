const express = require('express');
const executarBot = require('./bot');
const app = express();

app.use(express.json());
app.use(express.static('public'));

let pedidos = []; // Esta lista armazena o status que o HTML consulta

app.post('/ativar', (req, res) => {
    const { mac, key, user, pass } = req.body;
    // Evita duplicados e limpa pedidos antigos do mesmo MAC
    pedidos = pedidos.filter(p => p.mac !== mac);
    
    const novoPedido = { 
        mac, 
        key, 
        user, 
        pass, 
        status: "pendente", 
        concluidos: 0, 
        total: 15 
    };
    pedidos.push(novoPedido);
    res.json({ success: true });
});

app.get('/status', (req, res) => {
    const pedido = pedidos.find(p => p.mac === req.query.mac);
    if (pedido) {
        res.json(pedido);
    } else {
        res.status(404).json({ status: "nao_encontrado" });
    }
});

// O loop deve passar a lista completa para o bot poder alterar o status lá dentro
setInterval(() => {
    executarBot(pedidos); 
}, 5000);

app.listen(10000, () => console.log("Servidor Online"));
