const express = require('express');
const path = require('path');
const dnsConfig = require('./src/config/dns'); 
const enginePro = require('./src/bot/engine');      
const cleaner = require('./src/bot/cleaner');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let pedidos = [];
let botOcupado = false;

app.post('/ativar', (req, res) => {
    const { mac, key, usuario, senha, nome, sobrenome, nascimento, whatsapp, tipo } = req.body;
    pedidos = pedidos.filter(p => p.mac !== mac);
    
    const novoPedido = {
        mac, key, user: usuario, pass: senha,
        nome, sobrenome, nascimento, whatsapp,
        status: "pendente",
        mensagem: "Na fila de ativação...",
        indiceAtual: 0,
        total: dnsConfig.servidores.length,
        tipo: "ibopro"
    };
    pedidos.push(novoPedido);
    res.json({ success: true });
});

app.post('/limpar', (req, res) => {
    const { mac, key } = req.body;
    const pedidoLimpeza = { mac, key, status: "processando", mensagem: "Limpando aparelho...", tipo: "limpeza" };
    pedidos.push(pedidoLimpeza);
    res.json({ success: true });
});

app.get('/status', (req, res) => {
    const pedido = pedidos.find(p => p.mac === req.query.mac);
    res.json(pedido || { status: "nao_encontrado" });
});

setInterval(async () => {
    if (botOcupado) return;
    const pedido = pedidos.find(p => p.status === "pendente" || p.status === "processando");
    if (!pedido) return;

    botOcupado = true;
    try {
        if (pedido.tipo === "ibopro") await enginePro(pedidos);
        else if (pedido.tipo === "limpeza") {
            await cleaner(pedido);
            pedido.status = "ok";
            pedido.mensagem = "Limpeza concluída!";
        }
    } catch (e) {
        pedido.status = "erro";
        pedido.mensagem = "Erro: " + e.message;
    } finally { botOcupado = false; }
}, 5000);

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
