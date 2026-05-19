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
const { gerarTesteGratis } = require('./src/bot/teste_gratis'); 

let pedidos = [];
let processandoAgora = false;

// --- ROTA DO MÓDULO DE TESTE GRÁTIS AUTÔNOMO (NETPLAY ORIGINAL) ---
app.post('/api/teste-gratis', gerarTesteGratis);

// --- ROTA DE CONSULTA PARA O PAINEL ---
app.get('/api/cliente', async (req, res) => {
    const finalWhatsApp = req.query.id; 
    
    if (!finalWhatsApp) {
        return res.json({ success: false, mensagem: "ID não fornecido." });
    }

    try {
        const resultado = await consultarCliente(finalWhatsApp);
        
        if (resultado) {
            res.json({ success: true, dados: resultado });
        } else {
            res.json({ success: false, mensagem: "Número não localizado no banco de dados." });
        }
    } catch (error) {
        console.error("❌ Erro na rota de consulta:", error.message);
        res.status(500).json({ success: false, mensagem: "Erro ao conectar com o banco de dados." });
    }
});

// --- ROTA DO WEBHOOK ATUALIZADA (INTERCEPTA CADASTROS DO GESTORV3) ---
app.post('/webhook', async (req, res) => {
    console.log("📥 WEBHOOK RECEBIDO DO GESTORV3:", JSON.stringify(req.body, null, 2));

    try {
        // 1. Executa a gravação padrão no MongoDB que já funciona perfeitamente no seu webhook.js
        // Criamos uma resposta simulada para passar para o módulo local
        let statusEnviado = 200;
        let conteudoEnviado = "";
        const resSimulado = {
            status: (codigo) => { statusEnviado = codigo; return { send: (txt) => { conteudoEnviado = txt; } }; },
            send: (txt) => { conteudoEnviado = txt; }
        };

        await processarWebhook(req, resSimulado);

        // 2. Captura os dados que o Gestorv3 mandou
        const d = req.body;
        
        // Verifica se vieram dados de Smart TV preenchidos (MAC e KEY) vindos do formulário do Gestor
        const mac = d.mac || d.mac_address;
        const key = d.key || d.password_app || d.device_key || d.device_id;
        const dispositivo = d.dispositivo || d.device || "";

        const listaSmartTV = ['samsung', 'lg', 'roku', 'sansung', 'lgs']; // Incluindo variações de digitação
        const eSmartTv = dispositivo && listaSmartTV.includes(dispositivo.toLowerCase());

        // Se o cadastro veio com MAC/KEY preenchidos, joga o robô na fila na mesma hora!
        if (mac && key) {
            console.log(`📺 Capturado cadastro via Gestor para Smart TV (MAC: ${mac}). Adicionando na fila do engine...`);
            
            const novoPedido = {
                id: Date.now().toString(),
                mac: mac.trim(),
                key: key.trim(),
                device_id: key.trim(),
                user: d.usuario || d.usuario_iptv || d.login || '',
                pass: d.senha || d.senha_iptv || d.password || '',
                tipo: "adicionar",
                status: "pendente",
                mensagem: "⏳ AGUARDANDO NA FILA...",
                data: new Date(),
                dnsList: listaDns
            };

            // Remove duplicados da fila para o mesmo MAC e adiciona o novo
            pedidos = pedidos.filter(p => p.mac !== novoPedido.mac);
            pedidos.push(novoPedido);
        }

        // Devolve o status correto para o servidor do Gestorv3 saber que recebemos
        res.status(statusEnviado).send(conteudoEnviado || "OK");

    } catch (err) {
        console.error("❌ Erro ao interceptar Webhook para a fila do Puppeteer:", err.message);
        res.status(500).send("Erro interno");
    }
});

// --- ROTAS DE AUTOMAÇÃO MANUAL (FRONT-END) ---
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
        dnsList: listaDns 
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

// --- MOTOR DE GERENCIAMENTO DA FILA DO PUPPETEER ---
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
