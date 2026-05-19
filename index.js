const express = require('express');
const cors = require('cors'); 
const app = express();

// IMPORTAÇÃO DA LISTA DE DNS (Garanta que o arquivo existe em src/config/dns.js)
const listaDns = require('./src/config/dns.js');

// Liberação de segurança para o site ler os dados do servidor
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Importações dos motores de automação e módulos locais
const engine = require('./src/bot/engine');
const cleaner = require('./src/bot/cleaner');
const { processarWebhook, consultarCliente } = require('./src/bot/webhook');
const { gerarTesteGratis } = require('./src/bot/teste_gratis'); // Importando a nova lógica isolada

let pedidos = [];
let processandoAgora = false;

// --- ROTA DO NOVO MÓDULO DE TESTE GRÁTIS (NETPLAY INTEGRADO) ---
app.post('/api/teste-gratis', gerarTesteGratis);

// --- ROTA DE CONSULTA PARA O PAINEL ---
app.get('/api/cliente', async (req, res) => {
    // O painel envia os últimos 8 dígitos via parâmetro 'id'
    const finalWhatsApp = req.query.id; 
    
    if (!finalWhatsApp) {
        return res.json({ success: false, mensagem: "ID não fornecido." });
    }

    try {
        // Agora a função consultarCliente usa Regex para achar o final do número
        const resultado = await consultarCliente(finalWhatsApp);
        
        if (resultado) {
            // Envia os dados encontrados para o painel exibir
            res.json({ success: true, dados: resultado });
        } else {
            res.json({ success: false, mensagem: "Número não localizado no banco de dados." });
        }
    } catch (error) {
        console.error("❌ Erro na rota de consulta:", error.message);
        res.status(500).json({ success: false, mensagem: "Erro ao conectar com o banco de dados." });
    }
});

// --- ROTA DO WEBHOOK (GESTORV3) ---
app.post('/webhook', processarWebhook);

// --- ROTAS DE AUTOMAÇÃO (PUPPETEER) ---
app.post('/ativar', (req, res) => {
    const { mac, key, usuario, senha, tipo } = req.body;
    const novoPedido = {
        mac: mac ? mac.trim() : "",
        key: key ? key.trim() : "",
        user: usuario,
        pass: senha,
        tipo: tipo,
        status: "pendente",
        mensagem: "⏳ AGUARDANDO NA FILA...",
        data: new Date(),
        dnsList: listaDns // Injeta a lista de DNS automaticamente no pedido para o bot usar
    };
    pedidos = pedidos.filter(p => p.mac !== novoPedido.mac);
    pedidos.push(novoPedido);
    res.json({ success: true });
});

app.get('/status', (req, res) => {
    const macConsultado = req.query.mac;
    const indexAtual = pedidos.findIndex(p => p.mac === macConsultado);
    if (indexAtual !== -1) {
        const pedido = pedidos[indexAtual];
        res.json({ status: pedido.status, mensagem: pedido.mensagem, naFrente: indexAtual });
    } else {
        res.json({ status: "erro", mensagem: "Pedido não encontrado." });
    }
});

async function gerenciarFila() {
    if (processandoAgora || pedidos.length === 0) {
        setTimeout(gerenciarFila, 3000);
        return;
    }
    const pedido = pedidos[0];
    if (pedido.status === 'ok' || pedido.status === 'erro') {
        pedidos.shift();
        setTimeout(gerenciarFila, 1000);
        return;
    }
    processandoAgora = true;
    pedido.status = "processando";
    
    pedido.mensagem = "⚙️ PROCESSANDO NO SERVIDOR...";
    console.log(`🤖 Iniciando automação para MAC: ${pedido.mac}`);

    try {
        if (pedido.tipo === 'limpar') { 
            await cleaner(pedido); 
        } else { 
            await engine([pedido]); 
        }
        pedido.status = "ok";
        pedido.mensagem = "✅ FINALIZADO COM SUCESSO!";
    } catch (err) {
        console.error("❌ Erro na automação:", err.message);
        pedido.status = "erro";
        pedido.mensagem = "❌ ERRO: " + err.message;
    } finally {
        processandoAgora = false;
        gerenciarFila();
    }
}

gerenciarFila();

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor Imperium TV Ativo na porta ${PORT}`);
    console.log(`📡 ${listaDns.length} DNS carregados para o motor de ativação.`);
});
