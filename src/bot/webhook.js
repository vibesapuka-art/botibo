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
            nome: d.nome || 'Cliente Imperium',
            usuario_iptv: d.login_usuario || d.usuario || '',
            senha_iptv: d.senha_usuario || d.senha || '',
            vencimento: d.data_vencimento || '',
            valor: d.valor_plano || '',
            servidor: d.url_servidor || 'MultServidor',
            // O botão amarelo só aparece se houver um link válido aqui
            link_fatura: (d.link_fatura && d.link_fatura.includes('http')) ? d.link_fatura : '',
            status_fatura: d.status_fatura || '',
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
