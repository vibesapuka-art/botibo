const express = require('express');
const path = require('path');
const enginePro = require('./src/bot/engine');      
const gestorBot = require('./src/bot/gestor'); 
const cleanerBot = require('./src/bot/cleaner'); // Certifique-se que o arquivo existe em src/bot/

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let pedidos = [];
let botOcupado = false;

// Rota que recebe os comandos do Front-end
app.post('/ativar', (req, res) => {
    const { mac, key, usuario, senha, tipo } = req.body; 
    
    // Evita duplicidade de pedidos para o mesmo MAC
    pedidos = pedidos.filter(p => p.mac !== mac);
    
    const novoPedido = {
        mac: mac.trim(), 
        key: key ? key.trim() : "", 
        user: usuario ? usuario.trim() : "", 
        pass: senha ? senha.trim() : "",    
        tipo, // 'ativar', 'ibopro' ou 'limpar'
        status: "pendente",
        mensagem: tipo === 'limpar' ? "🧹 Na fila para limpeza..." : "⏳ Aguardando na fila..."
    };

    pedidos.push(novoPedido);
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

// LOOP DE EXECUÇÃO DO BOT
setInterval(async () => {
    if (botOcupado) return;
    
    const pedido = pedidos.find(p => p.status === "pendente");
    if (!pedido) return;

    botOcupado = true;
    pedido.status = "processando";

    try {
        // LÓGICA DE LIMPEZA
        if (pedido.tipo === 'limpar') {
            pedido.mensagem = "🧼 Iniciando limpeza do painel...";
            await cleanerBot(pedido); 
            pedido.mensagem = "✨ Painel limpo com sucesso!";
        } 
        // LÓGICA DE ATIVAÇÃO/REATIVAÇÃO
        else {
            pedido.mensagem = "📡 Conectando ao painel IBO...";
            const modoNovo = pedido.tipo === 'ativar';
            
            // Chama o motor principal (Engine)
            const resultado = await enginePro(pedidos, { manterAberto: modoNovo });

            // Se for cadastro NOVO, envia para o Gestor
            if (modoNovo && resultado && resultado.page) {
                pedido.mensagem = "📝 Registrando no Gestor...";
                await gestorBot(pedido, resultado.page);
            }
            pedido.mensagem = "✅ Procedimento concluído!";
        }

        pedido.status = "ok";

    } catch (e) {
        console.error("❌ Erro no processamento:", e.message);
        pedido.status = "erro";
        
        // Mensagens de erro baseadas nos logs recentes
        if (e.message.includes("timeout")) {
            pedido.mensagem = "⚠️ Site lento. Tente novamente.";
        } else {
            pedido.mensagem = "❌ Erro. Veja o print em /erro_final.png";
        }
    } finally {
        botOcupado = false;
    }
}, 10000);

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor ATV DIGITAL ativo na porta ${PORT}`);
});
