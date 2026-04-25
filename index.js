const express = require('express');
const path = require('path');

// Use ./ para indicar que a pasta src está na raiz do projeto
const engine = require('./src/bot/engine');
const cleaner = require('./src/bot/cleaner');
const gestorBot = require('./src/bot/gestor'); 

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const statusPedidos = {};

app.post('/ativar', async (req, res) => {
    const dados = req.body;
    const macId = dados.mac.toLowerCase();
    
    statusPedidos[macId] = { 
        ...dados,
        user: dados.usuario, 
        pass: dados.senha,
        status: "processando", 
        tipo: "ibopro",
        mensagem: "⏳ Iniciando..." 
    };

    const pedido = statusPedidos[macId];

    const executarFluxo = async () => {
        try {
            const modoNovo = dados.tipo === 'ativar';
            pedido.mensagem = "📡 Configurando DNS...";
            
            // 1. Motor técnico
            const resultadoEngine = await engine([pedido], { manterAberto: modoNovo });

            if (!modoNovo) {
                pedido.status = "ok";
                pedido.mensagem = "✅ Ativação concluída!";
                return;
            }

            // 2. Modo Novo: Segue para o gestor
            pedido.status = "ok"; 
            pedido.mensagem = "✅ Ativado! Finalizando cadastro...";

            if (resultadoEngine && resultadoEngine.page) {
                await gestorBot(pedido, resultadoEngine.page);
            }

        } catch (err) {
            console.error("Erro:", err.message);
            pedido.status = "erro";
            pedido.mensagem = "❌ Erro: " + err.message;
        }
    };

    executarFluxo();
    res.json({ success: true });
});

app.post('/limpar', async (req, res) => {
    const dados = req.body;
    const macId = dados.mac.toLowerCase();
    statusPedidos[macId] = { ...dados, mensagem: "Limpando..." };
    cleaner(statusPedidos[macId], statusPedidos[macId]);
    res.json({ success: true });
});

app.get('/status', (req, res) => {
    const mac = req.query.mac ? req.query.mac.toLowerCase() : null;
    res.json(statusPedidos[mac] || { mensagem: "Aguardando..." });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor Online na porta ${PORT}`);
});
