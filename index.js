const express = require('express');
const cors = require('cors'); 
const app = express();
const axios = require('axios');

// IMPORTAÇÃO DA LISTA DE DNS
const listaDns = require('./src/config/dns.js');

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

// --- ROTA DE PRÉ-GERAÇÃO: RESPONSÁVEL POR BUSCAR O LOGIN VAZIO NA NETPLAY ---
app.post('/api/pre-gerar-teste', async (req, res, next) => {
    console.log("🎲 [Netplay] Pré-gerando credenciais na rota isolada pós-termos...");
    // Mockamos dados mínimos necessários exigidos pelo módulo interno original para não quebrar a chamada
    req.body.whatsapp = "00000000000"; 
    req.body.tipoTeste = "com_adulto";

    return gerarTesteGratis(req, res, next);
});

// --- ROTA DEFINITIVA: SALVA OS DADOS DO CLIENTE AMARRADOS COM O LOGIN JÁ GERADO ---
app.post('/api/teste-gratis', async (req, res) => {
    const { 
        whatsapp, 
        nomeCliente, 
        sobrenomeCliente, 
        dataNascimento, 
        codPais, 
        dispositivo, 
        mac, 
        key,
        username, 
        password  
    } = req.body;

    if (!whatsapp) {
        return res.json({ success: false, mensagem: "O WhatsApp é obrigatório!" });
    }

    try {
        console.log(`🚀 [GestorV3] Sincronizando dados de ${nomeCliente} para o acesso ${username}`);

        // Encaminha as informações e amarra o usuário fixo direto no GestorV3
        try {
            await axios.post('https://gestorv3.pro/imperiumtv/central/registrar/', {
                nome: nomeCliente || "",
                sobrenome: sobrenomeCliente || "",
                username: username, 
                password: password, 
                data_nascimento: dataNascimento || "",
                cod_pais: codPais || "55",
                whatsapp: whatsapp.replace(/\D/g, ''),
                dispositivo: dispositivo || "celular",
                mac: mac ? mac.trim() : "",
                key: key ? key.trim() : ""
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
                },
                timeout: 15000
            });
            console.log(`💾 Cliente devidamente fixado no painel do Gestor!`);
        } catch (errGestor) {
            console.error("⚠️ Alerta: GestorV3 respondeu instável, prosseguindo com a fila da TV:", errGestor.message);
        }

        // Se for uma Smart TV, adiciona imediatamente na fila do Puppeteer (engine.js)
        const listaSmartTV = ['smart_tv', 'samsung', 'lg', 'roku', 'sansung', 'lgs'];
        if (dispositivo && listaSmartTV.includes(dispositivo.toLowerCase()) && mac && key) {
            console.log(`📺 Smart TV na fila: Jogando ${mac} para o injetor Puppeteer.`);
            
            pedidos.push({
                id: Date.now().toString(),
                status: "aguardando",
                tipo: "adicionar",
                mac: mac.trim(),
                key: key.trim(),
                device_id: key.trim(),
                user: username,
                pass: password,
                mensagem: "⏱️ AGUARDANDO ROBÔ..."
            });
        }

        return res.json({ success: true });

    } catch (error) {
        console.error("❌ Falha crítica no cadastro final:", error.message);
        res.status(500).json({ success: false, message: "Erro no servidor principal." });
    }
});

// --- DEMAIS ROTAS DA APLICAÇÃO PRESERVADAS ---
app.get('/api/cliente', async (req, res) => {
    const finalWhatsApp = req.query.id; 
    if (!finalWhatsApp) return res.json({ success: false, mensagem: "ID não fornecido." });
    try {
        const resultado = await consultarCliente(finalWhatsApp);
        if (resultado) res.json({ success: true, dados: resultado });
        else res.json({ success: false, mensagem: "Cliente não localizado." });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.post('/webhook', async (req, res) => {
    try { await processarWebhook(req, res); } catch (err) { console.error(err.message); }
});

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
        res.json({ status: pedidos[indexAtual].status, mensagem: pedidos[indexAtual].mensagem, naFrente: indexAtual });
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

    try {
        if (pedido.tipo === 'limpar') { await cleaner(pedido); } 
        else { await engine([pedido]); }
        pedido.status = "ok";
    } catch (err) {
        console.error(err.message);
        pedido.status = "erro";
    } finally {
        processandoAgora = false;
        gerenciarFila();
    }
}
gerenciarFila();

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => { console.log(`🚀 Servidor Imperium TV Ativo na porta ${PORT}`); });
