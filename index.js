const express = require('express');
const cors = require('cors'); 
const app = express();
const axios = require('axios'); // Responsável por enviar os dados da Netplay + Cliente para o GestorV3

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

// --- ROTA DE TESTE GRÁTIS: GERA NA NETPLAY -> CADASTRA NO GESTOR -> ATIVA SMART TV ---
app.post('/api/teste-gratis', async (req, res, next) => {
    // Interceptamos a resposta JSON para capturar o exato momento que a Netplay gera o teste
    const jsonOriginal = res.json;
    
    res.json = async function (dados) {
        // Se o teste foi gerado com total sucesso na Netplay
        if (dados && dados.success && dados.dados) {
            try {
                // 1. Pegamos os dados pessoais enviados pelo formulário do seu site
                const { 
                    nomeCliente, 
                    sobrenomeCliente, 
                    dataNascimento, 
                    codPais, 
                    whatsapp, 
                    dispositivo, 
                    mac, 
                    key 
                } = req.body;

                // 2. Pegamos o Usuário e Senha oficiais criados pela Netplay
                const userNetplay = dados.dados.username;
                const passNetplay = dados.dados.password;

                console.log(`✨ Netplay gerou credenciais com sucesso! User: ${userNetplay} | Pass: ${passNetplay}`);
                console.log(`🚀 Enviando dados de ${nomeCliente} para cadastro reverso no GestorV3...`);

                // 3. Cadastra o cliente no GestorV3 passando os dados dele + Usuário e Senha que a Netplay gerou!
                try {
                    await axios.post('https://gestorv3.pro/imperiumtv/central/registrar/', {
                        nome: nomeCliente || "",
                        sobrenome: sobrenomeCliente || "",
                        username: userNetplay, // Usa o usuário que veio da Netplay
                        password: passNetplay, // Usa a senha que veio da Netplay
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
                        timeout: 15000 // Aguarda o Gestor processar e salvar
                    });
                    console.log(`💾 Cliente registrado com sucesso no GestorV3 e mensagem disparada.`);
                } catch (errGestor) {
                    console.error("⚠️ Falha ao registrar no GestorV3, mas prosseguindo com o fluxo:", errGestor.message);
                }

                // 4. REGRA DAS SMART TVS: Se o cliente escolheu Samsung, LG ou Roku, adiciona na fila do robô
                const listaSmartTV = ['samsung', 'lg', 'roku', 'sansung', 'lgs'];
                if (dispositivo && listaSmartTV.includes(dispositivo.toLowerCase()) && mac && key) {
                    console.log(`📺 Smart TV detectada. Injetando dados da Netplay na fila do engine.js...`);
                    
                    pedidos.push({
                        id: Date.now().toString(),
                        status: "aguardando",
                        tipo: "adicionar",
                        mac: mac.trim(),
                        key: key.trim(),
                        device_id: key.trim(),
                        user: userNetplay, // Passa o login da Netplay pro robô
                        pass: passNetplay, // Passa a senha da Netplay pro robô
                        mensagem: "⏱️ NA FILA DE ESPERA..."
                    });
                }

            } catch (error) {
                console.error("❌ Erro interno no pós-processamento do teste grátis:", error.message);
            }
        }
        
        // Devolve o JSON original para o navegador do cliente atualizar a tela do site
        return jsonOriginal.call(this, dados);
    };

    // Deixa rodar o seu script original de geração da Netplay
    return gerarTesteGratis(req, res, next);
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

// --- ROTA DO WEBHOOK (Usado de forma passiva nas vendas normais do Gestor) ---
app.post('/webhook', async (req, res) => {
    console.log("📥 WEBHOOK RECEBIDO DO GESTORV3:", JSON.stringify(req.body, null, 2));
    try {
        await processarWebhook(req, res);
    } catch (err) {
        console.error("❌ Erro no processamento do webhook receptor:", err.message);
        if (!res.headersSent) res.status(500).send("Erro interno");
    }
});

// --- ROTAS DE STATUS E ATIVAÇÃO MANUAL ---
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
