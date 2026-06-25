require('dotenv').config();

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();

const engine = require('./src/bot/engine');
const cleaner = require('./src/bot/cleaner');

const {
    processarWebhook,
    consultarCliente,
    salvarDispositivoCliente
} = require('./src/bot/webhook');

const { gerarTesteGratis } = require('./src/bot/teste_gratis');
const pushRoutes = require('./src/routes/push');

// MÓDULO DO PAINEL TESTE
const painelTeste = require('./src/painelTeste/index.js');

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// SERVE A TELA DO PAINEL TESTE
app.use(
    '/painelTeste',
    express.static(path.join(__dirname, 'src/painelTeste/public'))
);

// ROTAS DO PAINEL TESTE
app.use('/api', painelTeste);

// ROTAS DE NOTIFICAÇÃO PUSH
app.use('/api/push', pushRoutes);

let pedidos = [];
let processandoAgora = false;

function criarChecklistAtualizacao() {
    return {
        acesso: false,
        validacao: false,
        limpeza: false,
        dns: false,
        acessoAdicionar: false,
        playlist1: false,
        playlist2: false,
        playlist3: false,
        playlist4: false,
        playlist5: false,
        finalizado: false
    };
}

app.post('/api/pre-gerar-teste', async (req, res, next) => {
    console.log("🎲 [Netplay] Pré-gerando credenciais na rota isolada pós-termos...");

    req.body.whatsapp = req.body.whatsapp
        ? req.body.whatsapp.replace(/\D/g, '')
        : "00000000000";

    req.body.tipoTeste = req.body.tipoTeste || "com_adulto";

    return gerarTesteGratis(req, res, next);
});

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

        if (mac && key) {
            await salvarDispositivoCliente({
                whatsapp,
                mac,
                key,
                tipo: dispositivo || "teste_gratis"
            });
        }

        const listaSmartTV = ['smart_tv', 'samsung', 'lg', 'roku', 'sansung', 'lgs'];

        if (
            dispositivo &&
            listaSmartTV.includes(dispositivo.toLowerCase()) &&
            mac &&
            key
        ) {
            console.log(`📺 Smart TV na fila: Jogando ${mac} para atualizar playlists.`);

            pedidos.push({
                id: Date.now().toString(),
                status: "aguardando",
                tipo: "atualizar",
                mac: mac.trim(),
                key: key.trim(),
                device_id: key.trim(),
                user: username,
                pass: password,
                whatsapp: whatsapp.replace(/\D/g, ''),
                titulo: "Aguardando robô",
                mensagem: "⏱️ Aguardando início da atualização...",
                progresso: 5,
                checklist: criarChecklistAtualizacao()
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

app.post('/ativar', async (req, res) => {
    const {
        mac,
        key,
        usuario,
        senha,
        tipo,
        whatsapp
    } = req.body;

    if (!mac || !key) {
        return res.json({
            success: false,
            mensagem: "MAC e KEY são obrigatórios."
        });
    }

    if (!usuario || !senha) {
        return res.json({
            success: false,
            mensagem: "Usuário IPTV e senha são obrigatórios."
        });
    }

    if (whatsapp) {
        try {
            await salvarDispositivoCliente({
                whatsapp,
                mac,
                key,
                tipo: tipo || "atualizar"
            });
        } catch (err) {
            console.error("⚠️ Não foi possível salvar dispositivo:", err.message);
        }
    }

    const tipoFinal = tipo || "atualizar";

    const novoPedido = {
        id: Date.now().toString(),
        mac: mac ? mac.trim() : "",
        key: key ? key.trim() : "",
        device_id: key ? key.trim() : "",
        user: usuario,
        pass: senha,
        tipo: tipoFinal,
        status: "pendente",
        titulo: "Aguardando robô",
        mensagem: "⏳ Aguardando na fila...",
        progresso: 5,
        etapaAtual: 1,
        totalEtapas: 10,
        data: new Date(),
        whatsapp: whatsapp ? whatsapp.replace(/\D/g, '') : "",
        checklist: criarChecklistAtualizacao()
    };

    pedidos = pedidos.filter(p => p.mac !== novoPedido.mac);
    pedidos.push(novoPedido);

    return res.json({
        success: true,
        mensagem: tipoFinal === "atualizar"
            ? "Atualização de playlists enviada para a fila."
            : "Solicitação enviada para a fila."
    });
});

app.get('/status', (req, res) => {
    const macConsultado = req.query.mac;
    const indexAtual = pedidos.findIndex(p => p.mac === macConsultado);

    if (indexAtual !== -1) {
        return res.json({
            success: true,
            id: pedidos[indexAtual].id,
            status: pedidos[indexAtual].status,
            titulo: pedidos[indexAtual].titulo || "",
            mensagem: pedidos[indexAtual].mensagem || "",
            progresso: pedidos[indexAtual].progresso || 0,
            etapaAtual: pedidos[indexAtual].etapaAtual || null,
            totalEtapas: pedidos[indexAtual].totalEtapas || null,
            playlistAtual: pedidos[indexAtual].playlistAtual || null,
            totalPlaylists: pedidos[indexAtual].totalPlaylists || null,
            checklist: pedidos[indexAtual].checklist || {},
            naFrente: indexAtual
        });
    }

    return res.json({
        success: false,
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
    pedido.progresso = Math.max(pedido.progresso || 0, 10);
    pedido.titulo = "Iniciando atualização";
    pedido.mensagem = "Preparando processo. Mantenha a TV desligada.";

    try {
        if (pedido.tipo === 'limpar') {
            pedido.titulo = "Limpando playlists";
            pedido.mensagem = "🧹 Limpando playlists antigas...";
            pedido.progresso = 15;

            await cleaner(pedido);

            pedido.status = "ok";
            pedido.titulo = "Tudo limpo";
            pedido.mensagem = "✅ Playlists limpas com sucesso.";
            pedido.progresso = 100;
            pedido.checklist = {
                ...(pedido.checklist || {}),
                finalizado: true
            };

        } else if (pedido.tipo === 'atualizar') {
            pedido.titulo = "Atualizando playlists";
            pedido.mensagem = "🧹 Primeiro vamos limpar as playlists antigas.";
            pedido.progresso = 12;

            await cleaner(pedido);

            pedido.titulo = "Adicionando novas playlists";
            pedido.mensagem = "📡 Agora vamos adicionar as novas playlists.";
            pedido.progresso = Math.max(pedido.progresso || 0, 42);

            await engine([pedido]);

            pedido.status = "ok";
            pedido.titulo = "Tudo pronto!";
            pedido.mensagem = "✅ Playlists atualizadas com sucesso. Pode ligar a TV.";
            pedido.progresso = 100;
            pedido.checklist = {
                ...(pedido.checklist || {}),
                finalizado: true
            };

        } else {
            pedido.titulo = "Adicionando playlists";
            pedido.mensagem = "📡 Adicionando playlists...";
            pedido.progresso = 40;

            await engine([pedido]);

            pedido.status = "ok";
            pedido.titulo = "Tudo pronto!";
            pedido.mensagem = "✅ Processado com sucesso.";
            pedido.progresso = 100;
            pedido.checklist = {
                ...(pedido.checklist || {}),
                finalizado: true
            };
        }

    } catch (err) {
        console.error(err.message);

        pedido.status = "erro";
        pedido.titulo = "Erro ao processar";
        pedido.mensagem = "❌ Erro ao processar: " + err.message;
        pedido.progresso = 100;

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
