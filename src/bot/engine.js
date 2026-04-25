const express = require('express');
const path = require('path');

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
    
    // Organiza os dados para o engine e gestor
    statusPedidos[macId] = { 
        ...dados,
        user: dados.usuario, 
        pass: dados.senha,
        status: "processando", 
        tipo: "ibopro",
        mensagem: "⏳ Iniciando ativação..." 
    };

    const pedido = statusPedidos[macId];

    const executarFluxo = async () => {
        try {
            const modoNovo = dados.tipo === 'ativar';
            pedido.mensagem = "📡 Configurando DNS no IBO Pro...";
            
            // 1. Roda o motor técnico
            const resultadoEngine = await engine([pedido], { manterAberto: modoNovo });

            if (!modoNovo) {
                pedido.status = "ok";
                pedido.mensagem = "✅ Ativação concluída!";
                return;
            }

            // 2. Se for novo, libera o cliente e continua o cadastro na mesma janela
            pedido.status = "ok";
            pedido.mensagem = "✅ Ativado! Finalizando seu cadastro...";

            if (resultadoEngine && resultadoEngine.page) {
                await gestorBot(pedido, resultadoEngine.page);
                console.log(`✅ Cadastro finalizado para ${pedido.nome}`);
            }

        } catch (err) {
            console.error("Erro no fluxo:", err.message);
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
    // Log limpo para não dar erro na inicialização
    console.log(`🚀 Sistema ATV DIGITAL Rodando na porta ${PORT}`);
    console.log(`📡 Modo Híbrido (Gestor + Engine) Ativo`);
});
