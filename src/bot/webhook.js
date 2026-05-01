const { MongoClient } = require('mongodb');
const uri = process.env.MONGO_URL;

async function consultarCliente(numeroWhatsApp) {
    if (!uri) throw new Error("MONGO_URL não configurada no Render.");
    const client = new MongoClient(uri);
    try {
        let numeroLimpo = numeroWhatsApp.replace(/\D/g, '');
        await client.connect();
        const db = client.db("ImperiumDB");
        const colecao = db.collection("clientes");

        console.log(`🔎 Buscando no banco: ${numeroLimpo}`);

        // Busca com ou sem o código 55 para garantir o resultado
        let tentativas = [numeroLimpo];
        if (numeroLimpo.startsWith('55')) {
            tentativas.push(numeroLimpo.substring(2));
        } else {
            tentativas.push('55' + numeroLimpo);
        }

        const resultado = await colecao.findOne({ whatsapp: { $in: tentativas } });
        
        if (resultado) {
            console.log(`✅ Cliente encontrado: ${resultado.nome}`);
        } else {
            console.log(`⚠️ Nenhum registro encontrado para: ${tentativas}`);
        }
        
        return resultado;
    } catch (err) {
        console.error("❌ Erro no MongoDB:", err.message);
        throw err;
    } finally {
        await client.close();
    }
}

async function processarWebhook(req, res) {
    if (!uri) return res.status(500).send("Sem URL do Banco");
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
        res.status(500).send(err.message);
    } finally {
        await client.close();
    }
}

module.exports = { processarWebhook, consultarCliente };
