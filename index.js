require('dotenv').config();

const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();

const listaDns = require('./src/config/dns.js');

const engine = require('./src/bot/engine');
const cleaner = require('./src/bot/cleaner');
const { processarWebhook, consultarCliente } = require('./src/bot/webhook');
const { gerarTesteGratis } = require('./src/bot/teste_gratis');

// MÓDULO DO PAINEL TESTE
const painelTeste = require('./src/painelTeste/index.js');

console.log('painelTeste:', typeof painelTeste);
console.log('painelTeste keys:', Object.keys(painelTeste));

// MIDDLEWARES PRINCIPAIS
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ROTAS DO PAINEL TESTE
// Mantém funcionando:
// /api/teste
// /api/teste/status/:jobId
// /api/tutorial
app.use('/api', painelTeste);

let pedidos = [];
let processandoAgora = false;

// ROTA DE PRÉ-GERAÇÃO: BUSCA O LOGIN VAZIO NA NETPLAY
app.post('/api/pre-gerar-teste', async (req, res, next) => {
    console.log("🎲 [Netplay] Pré-gerando credenciais na rota isolada pós-termos...");

    req.body.whatsapp = req.body.whatsapp
        ? req.body.whatsapp.replace(/\D/g, '')
        : "00000000000";

    req.body.tipoTeste = req.body.tipoTeste || "com_adulto";

    return gerarTesteGratis(req, res, next);
});

// ROTA DEFINITIVA: SALVA OS DADOS DO CLIENTE VINCULANDO COM O LOGIN RETORNADO
app.post('/api/teste-gratis', async (req, res, next) => {
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
        return res.json({
            success: false,
            mensagem: "O WhatsApp é obrigatório!"
        });
    }

    if (!username || !password) {
        console.log("🛰️ [index.js] Dados de usuário ausentes. Redirecionando fluxo direto para geração na Netplay...");
        return gerarTesteGratis(req, res, next);
    }

    try {
        console.log(`🚀 [GestorV3] Sincronizando dados de ${nomeCliente} para o acesso ${username}`);

        try {
            await axios.post('https://gestorv3.pro/imperiumtv/central/registrar/', {
                nome: nomeCliente || "Cliente",
                sobrenome: sobrenomeCliente || "Imperium",
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
            console.error("⚠️ Alerta: GestorV3 respondeu instável, prosseguindo com fluxo:", errGestor.message);
        }

        const listaSmartTV = ['smart_tv', 'samsung', 'lg', 'roku', 'sansung', 'lgs'];

        if (
            dispositivo &&
            listaSmartTV.includes(dispositivo.toLowerCase()) &&
            mac &&
            key
        ) {
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

        return res.json({
            success: true,
            mensagem: "Cadastro vinculado com sucesso!"
        });

    } catch (error) {
        console.error("❌ Falha crítica no cadastro final:", error.message);

        return res.status(500).json({
            success: false,
            message: "Erro no servidor principal durante a amarração."
        });
    }
});

app.get('/api/cliente', async (req, res) => {
    const finalWhatsApp = req.query.id;

    if (!finalWhatsApp) {
        return res.json({
            success: false,
            mensagem: "ID não fornecido."
        });
    }

    try {
        const resultado = await consultarCliente(finalWhatsApp);

        if (resultado) {
            return res.json({
                success: true,
                dados: resultado
            });
        }

        return res.json({
            success: false,
            mensagem: "Cliente não localizado."
        });

    } catch (err) {
        console.error("Erro ao consultar cliente:", err.message);

        return res.status(500).json({
            success: false,
            mensagem: "Erro ao consultar cliente."
        });
    }
});

app.post('/webhook', async (req, res) => {
    try {
        await processarWebhook(req, res);
    } catch (err) {
        console.error(err.message);

        return res.status(500).json({
            success: false,
            mensagem: "Erro ao processar webhook."
        });
    }
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

    return res.json({
        success: true
    });
});

app.get('/status', (req, res) => {
    const macConsultado = req.query.mac;
    const indexAtual = pedidos.findIndex(p => p.mac === macConsultado);

    if (indexAtual !== -1) {
        return res.json({
            status: pedidos[indexAtual].status,
            mensagem: pedidos[indexAtual].mensagem,
            naFrente: indexAtual
        });
    }

    return res.json({
        status: "erro",
        message: "Pedido não encontrado."
    });
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
        if (pedido.tipo === 'limpar') {
            await cleaner(pedido);
        } else {
            await engine([pedido]);
        }

        pedido.status = "ok";
        pedido.mensagem = "✅ PROCESSADO COM SUCESSO.";

    } catch (err) {
        console.error(err.message);

        pedido.status = "erro";
        pedido.mensagem = "❌ ERRO AO PROCESSAR.";
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
