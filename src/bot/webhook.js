const { MongoClient } = require('mongodb');
const uri = process.env.MONGO_URL;

async function consultarCliente(numeroWhatsApp) {
    if (!uri) throw new Error("MONGO_URL não configurada no Render.");
    
    const client = new MongoClient(uri);
    
    try {
        // Remove espaços ou traços caso o cliente digite errado no site
        const numeroLimpo = numeroWhatsApp.replace(/\D/g, '');
        
        await client.connect();
        const db = client.db("ImperiumDB");
        const colecao = db.collection("clientes");

        console.log(`🔎 Buscando no banco pelo WhatsApp: ${numeroLimpo}`);
        
        // Busca o documento onde o campo 'whatsapp' é igual ao número digitado
        const resultado = await colecao.findOne({ whatsapp: numeroLimpo });
        return resultado;
    } catch (err) {
        console.error("❌ Erro na consulta ao MongoDB:", err.message);
        throw err;
    } finally {
        await client.close();
    }
}

async function processarWebhook(req, res) {
    if (!uri) return res.status(500).send("Variável de banco ausente.");
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
            link_fatura: dados.link_fatura || '',
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
        res.status(500).send("Erro ao salvar: " + err.message);
    } finally {
        await client.close();
    }
}

module.exports = { processarWebhook, consultarCliente };
