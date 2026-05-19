const express = require('express');
const cors = require('cors'); 
const app = express();
const axios = require('axios');

// IMPORTAÇÃO DA LISTA DE DNS (Garanta que o arquivo existe em src/config/dns.js)
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

// --- ROTA NOVA: APENAS PRÉ-GERA O USER/PASS NA NETPLAY (ACIONADO NO PASSO 2) ---
app.post('/api/pre-gerar-teste', async (req, res, next) => {
    console.log("🎲 [Netplay] Pré-gerando credenciais em background...");
    
    // Forçamos um corpo temporário para o módulo gerarTesteGratis rodar sem dar erro de falta de dados
    req.body.whatsapp = "00000000000"; 
    req.body.tipoTeste = "com_adulto";

    return gerarTesteGratis(req, res, next);
});

// --- ROTA DE CONCLUSÃO: PEGA OS DADOS DA TELA E INJETA NO GESTORV3 E NO ROBÔ TV ---
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
        username, // Recebe o usuário gerado e travado na tela
        password  // Recebe a senha gerada e travada na tela
    } = req.body;

    if (!whatsapp) {
        return res.json({ success: false, mensagem: "O WhatsApp é obrigatório!" });
    }

    try {
        console.log(`🚀 [Cadastro Gestor] Vinculando ${nomeCliente} ao login Netplay: ${username}`);

        // Envia o formulário completo e amarrado com o Login/Senha pré-gerados para o GestorV3
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
            console.log(`💾 Registrado com sucesso no GestorV3!`);
        } catch (errGestor) {
            console.error("⚠️ GestorV3 retornou erro no salvamento, ignorando para não travar o cliente:", errGestor.message);
        }

        // SE FOR SMART TV (SAMSUNG / LG / RUKU): Coloca imediatamente no motor do Puppeteer
        const listaSmartTV = ['samsung', 'lg', 'roku', 'sansung', 'lgs'];
        if (dispositivo && listaSmartTV.includes(dispositivo.toLowerCase()) && mac && key) {
            console.log(`📺 Smart TV detectada. Adicionando ${mac} na fila do robô.`);
            
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

        // Retorna positivo para o site finalizar de carregar a tela
        return res.json({ success: true });

    } catch (error) {
        console.error("❌ Erro ao finalizar teste completo:", error.message);
        res.status(500).json({ success: false, mensagem: "Erro interno no servidor." });
    }
});

// --- ROTA DE CONSULTA DO PAINEL ---
app.get('/api/cliente', async (req, res) => {
    const finalWhatsApp = req.query.id; 
    if (!finalWhatsApp) return res.json({ success: false, mensagem: "ID não fornecido." });

    try {
        const resultado = await consultarCliente(finalWhatsApp);
        if (resultado) res.json({ success: true, dados: resultado });
        else res.json({ success: false, mensagem: "Cliente não localizado." });
    } catch (err) {
        res.status(500).json({ success: false, mensagem: "Erro no banco de dados." });
    }
});

// --- ROTA DO WEBHOOK RECEPTOR ---
app.post('/webhook', async (req, res) => {
    try {
        await processarWebhook(req, res);
    } catch (err) {
        console.error("❌ Erro no webhook receptor:", err.message);
        if (!res.headersSent) res.status(500).send("Erro interno");
    }
});

// --- ROTAS MANUAIS DE ATIVAÇÃO E STATUS ---
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

// --- ENGINE DA FILA DO PUPPETEER ---
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
        if (pedido.tipo === 'limpar') { 
            await cleaner(pedido); 
        } else { 
            await engine([pedido]); 
        }
        pedido.status = "ok";
    } catch (err) {
        console.error("❌ Erro na automação da fila:", err.message);
        pedido.status = "erro";
    } finally {
        processandoAgora = false;
        gerenciarFila();
    }
}

gerenciarFila();

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor Imperium TV Ativo na porta ${PORT}`);
});
