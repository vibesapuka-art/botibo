const express = require('express');
const app = express();
const path = require('path');
const engine = require('./src/bot/engine');
const cleaner = require('./src/bot/cleaner');
const gestor = require('./src/bot/gestor'); // Importando o novo bot

app.use(express.json());
app.use(express.static('public'));

let pedidos = [];

app.post('/ativar', (req, res) => {
    const { mac, key, usuario, senha, tipo, nome, sobrenome, whatsapp, aniversario } = req.body;
    
    const novoPedido = {
        mac: mac.trim(),
        key: key.trim(),
        user: usuario,
        pass: senha,
        nome: nome,
        sobrenome: sobrenome,
        whatsapp: whatsapp,
        aniversario: aniversario,
        tipo: tipo,
        status: "pendente",
        mensagem: "⏳ Na fila de espera..."
    };

    pedidos.push(novoPedido);
    res.json({ success: true });
});

app.get('/status', (req, res) => {
    const pedido = pedidos.find(p => p.mac === req.query.mac);
    res.json(pedido || { mensagem: "Não encontrado" });
});

// Loop principal de processamento
setInterval(async () => {
    const pedido = pedidos.find(p => p.status === "pendente");
    if (!pedido) return;

    pedido.status = "processando";

    if (pedido.tipo === 'limpar') {
        await cleaner(pedido);
    } else if (pedido.tipo === 'ativar') {
        // Primeiro faz o cadastro no Gestor V3
        const cadastroOk = await gestor(pedido);
        if (cadastroOk) {
            // Se o cadastro deu certo, segue para a ativação no IBO
            await engine([pedido]);
        }
    } else {
        // Modo Assinante (apenas IBO)
        await engine([pedido]);
    }
}, 5000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));

