const express = require('express');
const path = require('path');
const enginePro = require('./src/bot/engine');      
const gestorBot = require('./src/bot/gestor'); 

const app = express();

// Configurações básicas
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let pedidos = [];
let botOcupado = false;

// Rota para receber novos pedidos (Novo ou Assinante)
app.post('/ativar', (req, res) => {
    const { mac, key, usuario, senha, tipo } = req.body; 
    
    // Remove qualquer pedido pendente do mesmo MAC para evitar duplicidade
    pedidos = pedidos.filter(p => p.mac !== mac);
    
    const novoPedido = {
        mac: mac.trim(), 
        key: key ? key.trim() : "", 
        user: usuario ? usuario.trim() : "", 
        pass: senha ? senha.trim() : "",    
        tipo, // 'ativar' ou 'ibopro'
        status: "pendente",
        mensagem: "⏳ Aguardando na fila..."
    };

    pedidos.push(novoPedido);
    res.json({ success: true });
});

// Rota de consulta de status para o Front-end
app.get('/status', (req, res) => {
    const pedido = pedidos.find(p => p.mac.toLowerCase() === req.query.mac.toLowerCase());
    if (pedido) {
        res.json(pedido);
    } else {
        res.json({ status: "nao_encontrado", mensagem: "Pedido não localizado na fila." });
    }
});

// GERENCIADOR DA FILA (Executa a cada 10 segundos)
setInterval(async () => {
    // Se o bot já estiver processando alguém, aguarda o próximo ciclo
    if (botOcupado) return;
    
    // Busca o primeiro pedido da fila que esteja "pendente"
    const pedido = pedidos.find(p => p.status === "pendente");
    if (!pedido) return;

    botOcupado = true;
    
    // Atualiza status para o usuário ver na tela
    pedido.status = "processando";
    pedido.mensagem = "📡 Conectando ao painel IBO...";

    try {
        const modoNovo = pedido.tipo === "ativar";
        
        // 1. Executa o Motor do IBO Pro (Engine)
        // Passamos 'manterAberto' como true se for um cadastro NOVO para usar no gestor
        const resultado = await enginePro(pedidos, { manterAberto: modoNovo });

        // 2. Se for modo NOVO, prossegue para o Gestor usando a mesma aba aberta
        if (modoNovo && resultado && resultado.page) {
            pedido.mensagem = "📝 Gravando dados no Gestor...";
            await gestorBot(pedido, resultado.page);
        }

        // 3. Finalização com sucesso
        pedido.status = "ok";
        pedido.mensagem = "✅ Ativação concluída com sucesso!";

    } catch (e) {
        console.error("❌ Erro no Fluxo de Ativação:", e.message);
        pedido.status = "erro";
        
        // Tratamento de mensagens amigáveis baseadas nos erros do log
        if (e.message.includes("inválidos")) {
            pedido.mensagem = "❌ MAC ou Key incorretos.";
        } else if (e.message.includes("timeout") || e.message.includes("Waiting")) {
            pedido.mensagem = "⚠️ Site do IBO Pro lento. Tente novamente em instantes.";
        } else {
            pedido.mensagem = "❌ Erro técnico: " + e.message;
        }
    } finally {
        // Libera o bot para o próximo da fila, independente de ter dado erro ou sucesso
        botOcupado = false;
    }
}, 10000);

// Inicialização do servidor
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor ATV DIGITAL ativo na porta ${PORT}`);
});
