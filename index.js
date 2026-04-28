const express = require('express');
const app = express();
const path = require('path');
const engine = require('./src/bot/engine');
const cleaner = require('./src/bot/cleaner');
const gestor = require('./src/bot/gestor'); 
const sigmaConsultor = require('./src/bot/sigmaConsultor'); // NOVO: Importando o consultor do Sigma

app.use(express.json());
app.use(express.static('public'));

let pedidos = [];

// --- ROTA NOVA PARA CONSULTA SIGMA (SEM MEXER NO LOOP) ---
app.post('/consultar-sigma', async (req, res) => {
    const { whatsapp } = req.body;
    try {
        // Chama o bot do Sigma diretamente e aguarda a resposta
        const resultado = await sigmaConsultor(whatsapp);
        if (resultado) {
            res.json({ dados: resultado });
        } else {
            res.json({ erro: "Nenhum cadastro encontrado para este número." });
        }
    } catch (error) {
        res.json({ erro: "Erro ao consultar o painel. Tente novamente." });
    }
});

// --- LOGICA ORIGINAL (MANTIDA 100% IGUAL) ---
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

// Loop principal de processamento (MANTIDO 100% IGUAL)
setInterval(async () => {
    const pedido = pedidos.find(p => p.status === "pendente");
    if (!pedido) return;

    pedido.status = "processando";

    if (pedido.tipo === 'limpar') {
        await cleaner(pedido);
    } else if (pedido.tipo === 'ativar') {
        const cadastroOk = await gestor(pedido);
        if (cadastroOk) {
            await engine([pedido]);
        }
    } else {
        await engine([pedido]);
    }
}, 5000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
