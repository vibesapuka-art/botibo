const express = require('express');
const path = require('path');
const enginePro = require('./src/bot/engine');      
const gestorBot = require('./src/bot/gestor'); 
const cleanerBot = require('./src/bot/cleaner');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let pedidos = [];
let botOcupado = false;

app.post('/ativar', (req, res) => {
    const { mac, key, usuario, senha, tipo } = req.body; 
    
    // Limpa pedidos antigos do mesmo MAC para evitar conflito
    pedidos = pedidos.filter(p => p.mac.toLowerCase() !== mac.toLowerCase());
    
    const novoPedido = {
        mac: mac.trim(), 
        key: key ? key.trim() : "", 
        user: usuario ? usuario.trim() : "", 
        pass: senha ? senha.trim() : "",    
        tipo: tipo, 
        status: "pendente",
        mensagem: "⏳ Aguardando na fila..."
    };

    pedidos.push(novoPedido);
    console.log(`[LOG] Pedido de ${tipo} recebido para o MAC: ${mac}`);
    res.json({ success: true });
});

app.get('/status', (req, res) => {
    const pedido = pedidos.find(p => p.mac.toLowerCase() === req.query.mac.toLowerCase());
    if (pedido) {
        res.json(pedido);
    } else {
        res.json({ status: "nao_encontrado", mensagem: "Aguardando comando..." });
    }
});

// LOOP DE EXECUÇÃO - Ciclo de 5 segundos
setInterval(async () => {
    if (botOcupado) return;
    
    const pedido = pedidos.find(p => p.status === "pendente");
    if (!pedido) return;

    botOcupado = true;
    pedido.status = "processando";

    try {
        if (pedido.tipo === 'limpar') {
            await cleanerBot(pedido); 
        } 
        else {
            const modoNovo = pedido.tipo === 'ativar';
            const resultado = await enginePro(pedidos, { manterAberto: modoNovo });

            if (modoNovo && resultado && resultado.page) {
                pedido.mensagem = "📝 Registrando no Gestor...";
                await gestorBot(pedido, resultado.page);
            }
        }
        pedido.status = "ok";
    } catch (e) {
        console.error("❌ Erro no processamento:", e.message);
        pedido.status = "erro";
        pedido.mensagem = "❌ Falha no sistema. Tente de novo.";
    } finally {
        botOcupado = false;
    }
}, 5000);

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor ativo na porta ${PORT}`);
});
