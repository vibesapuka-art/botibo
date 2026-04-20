const express = require('express');
const path = require('path');
// Garante que o caminho do bot esteja correto para evitar erros no início
const { executarIboCom } = require('./src/bot/bot_ibocom');

const app = express();

// Configurações básicas
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let pedidos = [];

/**
 * Função de atualização de status
 */
function atualizarStatus(mac, status, mensagem, extras = {}) {
    const pedido = pedidos.find(p => p.mac === mac);
    if (pedido) {
        pedido.status = status;
        pedido.mensagem = mensagem;
        Object.assign(pedido, extras);
        console.log(`[Status ${mac}]: ${status} - ${mensagem}`);
    }
}

// ROTA: Iniciar ativação
app.post('/ativar', (req, res) => {
    const { mac, key, user, pass, tipo } = req.body;

    if (!mac) {
        return res.status(400).json({ error: "MAC é obrigatório" });
    }

    // Remove registros antigos do mesmo MAC para evitar conflitos
    pedidos = pedidos.filter(p => p.mac !== mac);

    const novoPedido = { 
        mac, key, user, pass, tipo, 
        status: 'iniciando', 
        mensagem: 'Iniciando robô...', 
        captchaDigitado: null 
    };
    
    pedidos.push(novoPedido);

    if (tipo === 'ibocom') {
        // Executa o bot sem travar o servidor
        executarIboCom(novoPedido, atualizarStatus).catch(err => {
            console.error("Erro na execução do bot:", err);
            atualizarStatus(mac, 'erro', 'Erro interno no robô.');
        });
    }

    res.json({ success: true, message: "Processo em fila" });
});

// ROTA: Resolver Captcha
app.post('/resolver-captcha', (req, res) => {
    const { mac, texto } = req.body;
    const pedido = pedidos.find(p => p.mac === mac);

    if (pedido) {
        pedido.captchaDigitado = texto;
        console.log(`[Captcha]: Recebido para o MAC ${mac}`);
        res.json({ success: true });
    } else {
        res.status(404).json({ error: "Pedido não localizado." });
    }
});

// ROTA: Status para o Front-end
app.get('/status', (req, res) => {
    const mac = req.query.mac;
    const pedido = pedidos.find(p => p.mac === mac);

    if (pedido) {
        res.json(pedido);
    } else {
        res.json({ status: 'aguardando', mensagem: 'Aguardando início...' });
    }
});

// ROTA: Raiz para evitar que o Render ache que o app caiu
app.get('/', (req, res) => {
    res.send('Servidor de Ativação Online');
});

// Porta dinâmica para o Render (CRUCIAL para evitar Application exited early)
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`=========================================`);
    console.log(`Servidor rodando na porta: ${PORT}`);
    console.log(`=========================================`);
});
