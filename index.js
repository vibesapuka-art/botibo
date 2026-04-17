const express = require('express');
const executarBot = require('./bot');
const app = express();

app.use(express.json());
app.use(express.static('public'));

let pedidos = [];
let botOcupado = false;

app.post('/ativar', (req, res) => {
    const { mac, key, user, pass } = req.body;
    
    // Monte aqui o DNS que você quer enviar para o IBO
    // Se o cliente digita o DNS, adicione um campo no HTML e mude aqui
    const dnsPadrao = "http://seu-dns-aqui.com:8080"; 
    const linkM3U = `${dnsPadrao}/get.php?username=${user}&password=${pass}&type=m3u_plus&output=ts`;

    pedidos = pedidos.filter(p => p.mac !== mac);
    
    pedidos.push({
        mac, 
        key, 
        user, 
        pass,
        m3u: linkM3U, // Agora o bot recebe o link preenchido
        status: "pendente",
        concluidos: 0,
        total: 1
    });
    res.json({ success: true });
});

app.get('/status', (req, res) => {
    const pedido = pedidos.find(p => p.mac === req.query.mac);
    res.json(pedido || { status: "nao_encontrado" });
});

setInterval(async () => {
    if (botOcupado) return;
    botOcupado = true;
    try {
        await executarBot(pedidos);
    } catch (e) { console.log("Erro loop"); }
    botOcupado = false;
}, 8000);

app.listen(10000, () => console.log("Servidor Rodando"));
