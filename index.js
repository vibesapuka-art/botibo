const express = require('express');
const app = express();
const engine = require('./src/bot/engine');
const cleaner = require('./src/bot/cleaner');

app.use(express.json());
app.use(express.static('public'));

let pedidos = [];
let processandoAgora = false; // Este é o cadeado do seu servidor

// 1. Recebe a solicitação e joga no FINAL da fila
app.post('/ativar', (req, res) => {
    const { mac, key, usuario, senha, tipo } = req.body;
    
    const novoPedido = {
        mac: mac.trim(),
        key: key.trim(),
        user: usuario,
        pass: senha,
        tipo: tipo,
        status: "pendente", // Todo mundo começa como pendente
        mensagem: "⏳ AGUARDANDO NA FILA...",
        data: new Date()
    };

    // Evita duplicados: se o mesmo MAC pedir de novo, remove o anterior da fila
    pedidos = pedidos.filter(p => p.mac !== novoPedido.mac);
    pedidos.push(novoPedido);
    
    res.json({ success: true });
});

// 2. O Status informa quem está na frente
app.get('/status', (req, res) => {
    const macConsultado = req.query.mac;
    const indexAtual = pedidos.findIndex(p => p.mac === macConsultado);
    
    if (indexAtual !== -1) {
        const pedido = pedidos[indexAtual];
        
        // A mágica acontece aqui: 
        // Ele conta quantos pedidos existem no Array ANTES da posição dele.
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

// 3. O MOTOR DA FILA (Processa um por um)
async function gerenciarFila() {
    // Se já tiver algo rodando, não faz nada e tenta de novo em 3 segundos
    if (processandoAgora) {
        setTimeout(gerenciarFila, 3000);
        return;
    }

    // Pega o primeiro pedido da lista (Posição 0)
    const pedido = pedidos[0]; 

    // Se não houver ninguém na lista, espera e tenta de novo
    if (!pedido) {
        setTimeout(gerenciarFila, 3000);
        return;
    }

    // Se o primeiro da lista já terminou (status ok ou erro), removemos ele para o próximo subir
    if (pedido.status === 'ok' || pedido.status === 'erro') {
        pedidos.shift(); // Remove o primeiro elemento da lista
        setTimeout(gerenciarFila, 1000);
        return;
    }

    // FECHA O CADEADO - Agora ninguém mais entra até terminar
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
        // ABRE O CADEADO - Só agora o próximo pedido pode ser processado
        processandoAgora = false;
        console.log(`🏁 Finalizado MAC: ${pedido.mac}. Próximo da fila...`);
        gerenciarFila(); // Chama o próximo imediatamente
    }
}

// Inicia o gerenciador de fila assim que o servidor liga
gerenciarFila();

app.listen(10000, () => console.log("Servidor Imperium TV Ativo na porta 10000"));
