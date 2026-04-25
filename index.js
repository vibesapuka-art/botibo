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
    
    statusPedidos[macId] = { 
        ...dados,
        user: dados.usuario, 
        pass: dados.senha,
        status: "processando", 
        tipo: "ibopro",
        mensagem: "⏳ Iniciando ativação..." 
    };

    const pedido = statusPedidos[macId];

    // FUNÇÃO PARA CONTROLAR O FLUXO SEM PESAR A MEMÓRIA
    const executarFluxo = async () => {
        try {
            // 1. CHAMA O ENGINE (IBO PRO)
            // Passamos um parâmetro extra 'manterAberto' para o engine não dar browser.close()
            const modoNovo = dados.tipo === 'ativar';
            
            pedido.mensagem = "📡 Configurando DNS no IBO Pro...";
            
            // Aqui enviamos o pedido e um sinal se deve fechar ou não
            // Se for NOVO, manterAberto é true. Se for ASSINANTE, é false.
            const resultadoEngine = await engine([pedido], { manterAberto: modoNovo });

            // Se for ASSINANTE, o engine já fechou o navegador e acaba aqui.
            if (!modoNovo) {
                pedido.status = "ok";
                pedido.mensagem = "✅ Ativação concluída!";
                return;
            }

            // 2. SE FOR NOVO: O cliente já é liberado, mas o processo continua
            pedido.status = "ok";
            pedido.mensagem = "✅ Ativação técnica pronta! Abrindo gestor...";

            // 3. CHAMA O GESTOR REAPROVEITANDO O NAVEGADOR
            // O resultadoEngine deve retornar o 'browser' ou a 'page' que ficou aberta
            if (resultadoEngine && resultadoEngine.browser) {
                await gestorBot(pedido, resultadoEngine.browser);
                console.log("Cadastro no gestor finalizado com sucesso.");
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

app.get('/status', (req, res) => {
    const mac = req.query.mac ? req.query.mac.toLowerCase() : null;
    res.json(statusPedidos[mac] || { mensagem: "Aguardando..." });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Sistema Híbrido: Memória Otimizada` + `\n` + `Dns: http://xw.pluss.fun/get.php?username=${pedido.user}&password=${pedido.pass}`));
