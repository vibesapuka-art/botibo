const express = require('express');
const botPro = require('./src/bot/bot');        // Seu bot IBO Pro atual
const botCom = require('./src/bot/bot_ibocom'); // O novo bot para o site .com
const dnsConfig = require('./src/config/dns');
const app = express();

app.use(express.json());
app.use(express.static('public'));

let pedidos = [];
let botOcupado = false;

// Rota para iniciar a ativação
app.post('/ativar', (req, res) => {
    const { mac, key, user, pass, tipo } = req.body;
    
    // Filtra para não duplicar o mesmo MAC na fila
    pedidos = pedidos.filter(p => p.mac !== mac);
    
    const novoPedido = {
        mac, key, user, pass, tipo,
        status: "pendente",
        mensagem: "Aguardando na fila...",
        captchaBase64: null,
        captchaDigitado: null,
        indiceAtual: 0,
        total: dnsConfig.servidores.length
    };

    pedidos.push(novoPedido);
    res.json({ success: true });
});

// Rota para o cliente enviar o texto do Captcha
app.post('/resolver-captcha', (req, res) => {
    const { mac, texto } = req.body;
    const pedido = pedidos.find(p => p.mac === mac);
    if (pedido) {
        pedido.captchaDigitado = texto;
        pedido.status = "pendente"; // Faz o robô tentar logar novamente
        pedido.mensagem = "Captcha recebido! Retomando...";
        res.json({ success: true });
    } else {
        res.status(404).json({ error: "Pedido não encontrado" });
    }
});

// Consulta de status para o Painel
app.get('/status', (req, res) => {
    const pedido = pedidos.find(p => p.mac === req.query.mac);
    res.json(pedido || { status: "nao_encontrado" });
});

// Loop de execução
setInterval(async () => {
    if (botOcupado) return;
    
    const pedido = pedidos.find(p => p.status === "pendente" || p.status === "aguardando_captcha");
    if (!pedido) return;

    botOcupado = true;
    try {
        if (pedido.tipo === "ibopro") {
            await botPro(pedidos); // Chama sua lógica atual
        } else if (pedido.tipo === "ibocom") {
            await botCom(pedido);  // Chama a nova lógica do .com
        }
    } catch (e) {
        console.log("Erro no loop:", e.message);
    } finally {
        botOcupado = false;
    }
}, 5000);

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
