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
    
    // Limpa pedidos antigos do mesmo MAC para não duplicar na fila
    pedidos = pedidos.filter(p => p.mac !== mac);
    
    const novoPedido = {
        mac: mac.trim(), 
        key: key ? key.trim() : "", 
        user: usuario ? usuario.trim() : "", // Mapeia para 'user'
        pass: senha ? senha.trim() : "",    // Mapeia para 'pass'
        tipo, // 'ativar' (Novo) ou 'ibopro' (Assinante)
        status: "pendente",
        mensagem: "⏳ Aguardando na fila..."
    };

    pedidos.push(novoPedido);
    res.json({ success: true });
});

app.get('/status', (req, res) => {
    const pedido = pedidos.find(p => p.mac.toLowerCase() === req.query.mac.toLowerCase());
    res.json(pedido || { status: "nao_encontrado", mensagem: "Pedido não localizado." });
});

// LOOP DE PROCESSAMENTO (Roda a cada 8 segundos)
setInterval(async () => {
    if (botOcupado) return;
    
    const pedido = pedidos.find(p => p.status === "pendente");
    if (!pedido) return;

    botOcupado = true;
    
    // IMPORTANTE: Mudar para 'processando' para o engine.js encontrar o pedido
    pedido.status = "processando";
    pedido.mensagem = "📡 Iniciando ativação técnica...";

    try {
        // 1. Executa a parte técnica (IBO PRO)
        // Passamos o parâmetro para manter aberto se for um cadastro NOVO
        const modoNovo = pedido.tipo === "ativar";
        const resultado = await enginePro(pedidos, { manterAberto: modoNovo });

        // 2. Se for modo NOVO, chama o gestor usando a mesma aba
        if (modoNovo && resultado && resultado.page) {
            pedido.mensagem = "📝 Ativado! Gravando no Gestor...";
            await gestorBot(pedido, resultado.page);
        }

        // 3. Finalização com sucesso
        pedido.status = "ok";
        pedido.mensagem = "✅ Processo concluído com sucesso!";

    } catch (e) {
        console.error("❌ Erro no Fluxo:", e.message);
        pedido.status = "erro";
        pedido.mensagem = "⚠️ Erro: " + e.message;
    } finally {
        botOcupado = false;
    }
}, 8000);

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Servidor ATV DIGITAL ativo na porta ${PORT}`));
