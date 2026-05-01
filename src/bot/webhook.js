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

        let tentativas = [numeroLimpo];
        if (numeroLimpo.startsWith('55')) {
            tentativas.push(numeroLimpo.substring(2));
        } else {
            tentativas.push('55' + numeroLimpo);
        }

        return await colecao.findOne({ whatsapp: { $in: tentativas } });
    } catch (err) {
        console.error("❌ Erro MongoDB:", err.message);
        throw err;
    } finally {
        await client.close();
    }
}

async function processarWebhook(req, res) {
    if (!uri) return res.status(500).send("Sem URL do Banco");
    const client = new MongoClient(uri);
    try {
        const d = req.body; 
        
        const clienteData = {
            whatsapp: d.whatsapp ? d.whatsapp.replace(/\D/g, '') : '',
            // Ajustado para 'nome_cliente' conforme seu JSON
            nome: d.nome_cliente || d.nome || 'Cliente Imperium',
            usuario_iptv: d.usuario || '',
            senha_iptv: d.senha || '',
            vencimento: d.vencimento || '',
            valor: d.valor_plano || '',
            // Ajustado para 'nome_servidor' conforme seu JSON
            servidor: d.nome_servidor || 'MultServidor',
            // Agora garantido em minúsculo conforme seu JSON
            link_fatura: d.link_fatura || '',
            status_fatura: d.status_fatura || 'Pendente',
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
