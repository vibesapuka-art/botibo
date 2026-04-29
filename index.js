const express = require('express');
const app = express();
const engine = require('./src/bot/engine');
const cleaner = require('./src/bot/cleaner');
const gestor = require('./src/bot/gestor'); 

app.use(express.json());
app.use(express.static('public'));

let pedidos = [];

// ROTA PARA RECEBER OS PEDIDOS DO SITE
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
        mensagem: "⏳ Na fila de processamento..."
    };

    // Remove duplicados antes de adicionar
    pedidos = pedidos.filter(p => p.mac !== novoPedido.mac);
    pedidos.push(novoPedido);
    res.json({ success: true });
});

// ROTA DE STATUS (O index.html lê isso para a barra de progresso)
app.get('/status', (req, res) => {
    const macConsultado = req.query.mac;
    // Encontra o index do pedido atual na lista total de pedidos
    const indexAtual = pedidos.findIndex(p => p.mac === macConsultado);
    
    if (indexAtual !== -1) {
        const pedido = pedidos[indexAtual];
        
        // Conta quantos pedidos com status "pendente" ou "processando" existem ANTES dele
        const naFrente = pedidos.slice(0, indexAtual).filter(p => 
            p.status === "pendente" || p.status === "processando"
        ).length;

        res.json({ 
            status: pedido.status, 
            mensagem: pedido.mensagem,
            naFrente: naFrente 
        });
    } else {
        res.json({ status: "erro", mensagem: "Pedido não encontrado." });
    }
});


// LOOP DE PROCESSAMENTO - O CORAÇÃO DO BOT
setInterval(async () => {
    const pedido = pedidos.find(p => p.status === "pendente");
    if (!pedido) return;

    pedido.status = "processando";
    console.log(`🤖 Iniciando tarefa: ${pedido.tipo} para o MAC: ${pedido.mac}`);

    try {
        if (pedido.tipo === 'limpar') {
            // O cleaner.js define a mensagem: "✅ Tudo limpo! Aparelho liberado."
            await cleaner(pedido);
            pedido.status = "ok";
        } 
        else if (pedido.tipo === 'assinante') {
            // O engine.js define as mensagens: "📡 Acessando...", "📝 Gravando..."
            await engine([pedido]); 
            // Garante que a mensagem final seja a do Engine (Sucesso na Playlist)
            pedido.status = "ok";
        }
        else if (pedido.tipo === 'ativar') {
            const cadastroOk = await gestor(pedido);
            if (cadastroOk) {
                await engine([pedido]);
                pedido.status = "ok";
            } else {
                pedido.status = "erro";
                pedido.mensagem = "❌ Falha no cadastro do gestor.";
            }
        }
    } catch (err) {
        console.error("Erro no processamento:", err.message);
        pedido.status = "erro";
        pedido.mensagem = "❌ Erro crítico: " + err.message;
    }
}, 5000);

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Servidor ImperiumTV rodando na porta ${PORT}`));
