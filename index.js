const express = require('express');
const path = require('path');

// IMPORTANTE: Se o erro persistir, verifique se o dns.js exporta 'servidores'
const dnsConfig = require('./src/config/dns'); 

// Mapeamento correto dos bots conforme sua estrutura
const enginePro = require('./src/bot/engine');      // Este é o do iboproapp.com
const botIboCom = require('./src/bot/bot_ibocom'); // Este é o do iboplayer.com

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let pedidos = [];
let botOcupado = false;

app.post('/ativar', (req, res) => {
    const { mac, key, user, pass, tipo } = req.body;
    
    pedidos = pedidos.filter(p => p.mac !== mac);
    
    // Garantia para não dar erro de 'length' se o arquivo de DNS falhar
    const listaDNS = (dnsConfig && dnsConfig.servidores) ? dnsConfig.servidores : [];

    const novoPedido = {
        mac, key, user, pass, tipo,
        status: "pendente",
        mensagem: "Iniciando processamento...",
        captchaBase64: null,
        captchaDigitado: null,
        indiceAtual: 0,
        total: listaDNS.length 
    };

    pedidos.push(novoPedido);
    res.json({ success: true });
});

// ... (rotas de status e captcha iguais às anteriores) ...

setInterval(async () => {
    if (botOcupado) return;
    
    const pedido = pedidos.find(p => p.status === "pendente");
    if (!pedido) return;

    botOcupado = true;
    try {
        if (pedido.tipo === "ibopro") {
            // DIRECIONA PARA O SITE: iboproapp.com
            await enginePro(pedidos); 
        } else if (pedido.tipo === "ibocom") {
            // DIRECIONA PARA O SITE: iboplayer.com
            await botIboCom(pedido);  
        }
    } catch (e) {
        pedido.status = "erro";
        pedido.mensagem = e.message;
    } finally {
        botOcupado = false;
    }
}, 8000);

app.listen(process.env.PORT || 10000);
