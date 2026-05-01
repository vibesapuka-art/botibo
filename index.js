const express = require('express');
const cors = require('cors'); 
const app = express();

// Resolve o erro de "Conexão com o servidor" permitindo acesso do navegador
app.use(cors());

const engine = require('./src/bot/engine');
const cleaner = require('./src/bot/cleaner');
const { processarWebhook, consultarCliente } = require('./src/bot/webhook');

app.use(express.json());
app.use(express.static('public'));

let pedidos = [];
let processandoAgora = false;

// --- ROTAS DO BANCO DE DADOS (IMPERIUMDB) ---

// Recebe os dados do GestorV3 e salva no MongoDB
app.post('/webhook', processarWebhook);

// Rota que o botão "VERIFICAR STATUS" do seu site vai chamar
app.get('/api/cliente', async (req, res) => {
    const busca = req.query.id; 
    try {
        const resultado = await consultarCliente(busca);

        if (resultado) {
            // Retorna todos os dados: whatsapp, login, senha, vencimento, valor e link
            res.json({ success: true, dados: resultado });
        } else {
            res.json({ 
                success: false, 
                mensagem: "Cliente não localizado. Verifique os dados ou fale com o suporte." 
            });
        }
    } catch (error) {
        res.status(500).json({ success: false, mensagem: "Erro interno no servidor de dados." });
    }
});

// --- FIM DAS ROTAS DE DADOS ---

// 1. Recebe a solicitação de ativação (IBO Player / Outros)
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
        data: new Date()
    };

    pedidos = pedidos.filter(p => p.mac !== novoPedido.mac);
    pedidos.push(novoPedido);
    
    res.json({ success: true });
});

// 2. Consulta o status da fila de ativação
app.get('/status', (req, res) => {
    const macConsultado = req.query.mac;
    const indexAtual = pedidos.findIndex(p => p.mac === macConsultado);
    
    if (indexAtual !== -1) {
        const pedido = pedidos[indexAtual];
        const naFrente = indexAtual; 

        res.json({ 
            status: pedido.status, 
            mensagem: pedido.mensagem,
            naFrente: naFrente 
        });
    } else {
        res.json({ status: "erro", mensagem: "Pedido não encontrado." });
    }
});

// 3. Motor da Fila (Automação Puppeteer)
async function gerenciarFila() {
    if (processandoAgora) {
        setTimeout(gerenciarFila, 3000);
        return;
    }

    const pedido = pedidos[0]; 

    if (!pedido) {
        setTimeout(gerenciarFila, 3000);
        return;
    }

    if (pedido.status === 'ok' || pedido.status === 'erro') {
        pedidos.shift(); 
        setTimeout(gerenciarFila, 1000);
        return;
    }

    processandoAgora = true;
    pedido.status = "processando";
    console.log(`🤖 Iniciando processo para o MAC: ${pedido.mac}`);

    try {
        if (pedido.tipo === 'limpar') {
            await cleaner(pedido);
        } else {
            await engine([pedido]);
        }
        pedido.status = "ok";
        pedido.mensagem = "✅ FINALIZADO COM SUCESSO!";
    } catch (err) {
        pedido.status = "erro";
        pedido.mensagem = "❌ ERRO: " + err.message;
    } finally {
        processandoAgora = false;
        console.log(`🏁 Finalizado MAC: ${pedido.mac}. Próximo da fila...`);
        gerenciarFila();
    }
}

gerenciarFila();

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Servidor Imperium TV Ativo na porta ${PORT}`));
