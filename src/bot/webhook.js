const { MongoClient } = require('mongodb');
const uri = process.env.MONGO_URL;

async function consultarCliente(numeroWhatsApp) {
    if (!uri) throw new Error("MONGO_URL não configurada.");
    const client = new MongoClient(uri);
    try {
        let numeroLimpo = numeroWhatsApp.replace(/\D/g, '');
        
        await client.connect();
        const db = client.db("ImperiumDB");
        const colecao = db.collection("clientes");

        console.log(`🔎 Tentando localizar: ${numeroLimpo}`);

        // Criamos uma lista de tentativas para não ter erro
        let tentativas = [numeroLimpo];
        
        if (numeroLimpo.startsWith('55')) {
            tentativas.push(numeroLimpo.substring(2)); // Tenta sem o 55
        } else {
            tentativas.push('55' + numeroLimpo); // Tenta com o 55
        }

        // Busca por qualquer uma das variações
        const cliente = await colecao.findOne({ 
            whatsapp: { $in: tentativas } 
        });

        if (cliente) {
            console.log(`✅ Cliente encontrado: ${cliente.nome}`);
            return cliente;
        } else {
            console.log(`⚠️ Nenhum registro encontrado para as variações: ${tentativas}`);
            return null;
        }
    } finally {
        await client.close();
    }
}

async function processarWebhook(req, res) {
    if (!uri) return res.status(500).send("Erro de configuração");
    const client = new MongoClient(uri);
    try {
        const dados = req.body;
        const clienteData = {
            whatsapp: dados.whatsapp ? dados.whatsapp.replace(/\D/g, '') : '',
            nome: dados.nome || 'Cliente Novo',
            usuario_iptv: dados.login_usuario || dados.usuario || '',
            senha_iptv: dados.senha_usuario || dados.senha || '',
            vencimento: dados.data_vencimento || '',
            valor: dados.valor_plano || '',
            data_atualizacao: new Date()
        };
        await client.connect();
        const db = client.db("ImperiumDB");
        await db.collection("clientes").updateOne(
            { whatsapp: clienteData.whatsapp },
            { $set: clienteData },
            { upsert: true }
        );
        res.status(200).send("OK");
    } catch (err) {
        res.status(500).send(err.message);
    } finally {
        await client.close();
    }
}

module.exports = { processarWebhook, consultarCliente };
