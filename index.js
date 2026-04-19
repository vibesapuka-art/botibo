const express = require('express');
const path = require('path');

// Importando os robôs dos caminhos corretos conforme suas fotos
const enginePro = require('./src/bot/engine');      // Para o iboproapp.com
const botIboCom = require('./src/bot/bot_ibocom'); // Para o iboplayer.com
const dnsConfig = require('./src/config/dns');    // Ajustado para a pasta config

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let pedidos = [];
let botOcupado = false;

// Rota de Ativação
app.post('/ativar', (req, res) => {
    const { mac, key, user, pass, tipo } = req.body;
    
    // Evita duplicados
    pedidos = pedidos.filter(p => p.mac !== mac);
    
    const novoPedido = {
        mac, key, user, pass, tipo,
        status: "pendente",
        mensagem: "Aguardando na fila...",
        captchaBase64: null,
        captchaDigitado: null,
        indiceAtual: 0,
        total: dnsConfig.servidores ? dnsConfig.servidores.length : 1
    };

    pedidos.push(novoPedido);
    res.json({ success: true });
});

// Rota para o Captcha
app.post('/resolver-captcha', (req, res) => {
    const { mac, texto } = req.body;
    const pedido = pedidos.find(p => p.mac === mac);
    if (pedido) {
        pedido.captchaDigitado = texto;
        pedido.status = "pendente";
        pedido.mensagem = "Retomando com o Captcha...";
        res.json({ success: true });
    } else {
        res.status(404).json({ error: "Não encontrado" });
    }
});

app.get('/status', (req, res) => {
    const pedido = pedidos.find(p => p.mac === req.query.mac);
    res.json(pedido || { status: "nao_encontrado" });
});

// Loop de Processamento
setInterval(async () => {
    if (botOcupado) return;
    
    const pedido = pedidos.find(p => p.status === "pendente" || p.status === "aguardando_captcha");
    if (!pedido) return;

    botOcupado = true;
    try {
        if (pedido.tipo === "ibopro") {
            // Chama o seu engine.js atual
            await enginePro(pedidos); 
        } else if (pedido.tipo === "ibocom") {
            // Chama o novo bot_ibocom.js
            await botIboCom(pedido);  
        }
    } catch (e) {
        console.error("Erro no Robô:", e.message);
        pedido.status = "erro";
        pedido.mensagem = "Erro: " + e.message;
    } finally {
        botOcupado = false;
    }
}, 8000);

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Servidor ativo na porta ${PORT}`));
