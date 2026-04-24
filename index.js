const express = require('express');
const path = require('path');
const dnsConfig = require('./src/config/dns'); 
const enginePro = require('./src/bot/engine');      
const cleaner = require('./src/bot/cleaner'); // Novo módulo de limpeza

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let pedidos = [];
let botOcupado = false;

// ROTA PARA ATIVAÇÃO COMPLETA (NOVO CLIENTE OU RENOVAÇÃO)
app.post('/ativar', (req, res) => {
    const { mac, key, usuario, senha, nome, sobrenome, whatsapp, tipo } = req.body;
    
    // Remove pedidos antigos com o mesmo MAC para não duplicar na fila
    pedidos = pedidos.filter(p => p.mac !== mac);
    
    const novoPedido = {
        mac, key, 
        user: usuario, 
        pass: senha,
        nome, sobrenome, whatsapp,
        status: "pendente",
        mensagem: "Na fila de ativação...",
        indiceAtual: 0,
        total: dnsConfig.servidores.length,
        tipo: "ibopro" // Identifica como ativação
    };

    pedidos.push(novoPedido);
    res.json({ success: true });
});

// ROTA EXCLUSIVA PARA LIMPEZA (APENAS DELETAR LISTAS)
app.post('/limpar', (req, res) => {
    const { mac, key } = req.body;
    
    pedidos = pedidos.filter(p => p.mac !== mac);

    const pedidoLimpeza = { 
        mac, 
        key, 
        status: "pendente", 
        tipo: "limpeza", // Identifica como limpeza
        mensagem: "Aguardando bot para limpeza..." 
    };

    pedidos.push(pedidoLimpeza);
    res.json({ success: true });
});

// ROTA DE STATUS (O FRONT-END FICA CONSULTANDO AQUI)
app.get('/status', (req, res) => {
    const pedido = pedidos.find(p => p.mac === req.query.mac);
    if (pedido) {
        res.json(pedido);
    } else {
        res.json({ status: "nao_encontrado", mensagem: "Pedido não localizado." });
    }
});

// MOTOR DE PROCESSAMENTO (O CORAÇÃO DO BOT)
setInterval(async () => {
    if (botOcupado) return;
    
    // Busca o próximo da fila (seja ativação ou limpeza)
    const pedido = pedidos.find(p => p.status === "pendente" || p.status === "processando");
    
    if (!pedido) return;

    botOcupado = true;
    pedido.status = "processando";

    try {
        if (pedido.tipo === "limpeza") {
            // Chama o arquivo cleaner.js
            await cleaner(pedido);
            pedido.status = "ok";
            pedido.mensagem = "✅ Limpeza concluída com sucesso!";
        } else {
            // Chama o arquivo engine.js original para adicionar DNS e Gestor
            await enginePro(pedidos); 
        }
    } catch (error) {
        console.error("Erro no processamento:", error);
        pedido.status = "erro";
        pedido.mensagem = "❌ Erro técnico: " + error.message;
    } finally {
        botOcupado = false;
    }
}, 5000); // Tenta processar a cada 5 segundos

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`=================================`);
    console.log(`SERVIDOR ON: PORTA ${PORT}`);
    console.log(`=================================`);
});
