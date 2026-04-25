const express = require('express');
const path = require('path');
const enginePro = require('./src/bot/engine');      
const gestorBot = require('./src/bot/gestor'); 

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let pedidos = [];
let botOcupado = false;

app.post('/ativar', (req, res) => {
    const { mac, key, usuario, senha, tipo } = req.body; 
    pedidos = pedidos.filter(p => p.mac !== mac);
    
    const novoPedido = {
        mac: mac.trim(), 
        key: key ? key.trim() : "", 
        user: usuario ? usuario.trim() : "", 
        pass: senha ? senha.trim() : "",    
        tipo, 
        status: "pendente",
        mensagem: "⏳ Aguardando na fila..."
    };

    pedidos.push(novoPedido);
    res.json({ success: true });
});

app.get('/status', (req, res) => {
    const pedido = pedidos.find(p => p.mac.toLowerCase() === req.query.mac.toLowerCase());
    res.json(pedido || { status: "nao_encontrado", mensagem: "Aguardando..." });
});

setInterval(async () => {
    if (botOcupado) return;
    
    const pedido = pedidos.find(p => p.status === "pendente");
    if (!pedido) return;

    botOcupado = true;
    pedido.status = "processando";
    pedido.mensagem = "📡 Conectando ao painel IBO...";

    try {
        const modoNovo = pedido.tipo === "ativar";
        const resultado = await enginePro(pedidos, { manterAberto: modoNovo });

        if (modoNovo && resultado && resultado.page) {
            pedido.mensagem = "📝 Gravando no Gestor...";
            await gestorBot(pedido, resultado.page);
        }

        pedido.status = "ok";
        pedido.mensagem = "✅ Ativação concluída!";

    } catch (e) {
        console.error("Erro:", e.message);
        pedido.status = "erro";
        pedido.mensagem = "❌ Erro: " + e.message;
    } finally {
        botOcupado = false;
    }
}, 10000); // 10 segundos entre verificações

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Servidor ATV DIGITAL ativo na porta ${PORT}`));
