const { MongoClient } = require('mongodb');

// String de conexão direta para evitar o erro de 'Invalid scheme'
const uri = "mongodb+srv://vibesapuka_db_user:fG9c7WwavgNkYSoR@cluster0.q3bhsxo.mongodb.net/ImperiumDB?retryWrites=true&w=majority";
const client = new MongoClient(uri);

async function processarWebhook(req, res) {
    try {
        const dados = req.body;
        console.log("📥 Dados recebidos do Gestor:", JSON.stringify(dados));

        // O GestorV3 envia 'WhatsApp' com W maiúsculo conforme o vídeo
        const whatsappRaw = dados.WhatsApp || dados.whatsapp;
        
        if (!whatsappRaw) {
            console.log("⚠️ Nenhum número de WhatsApp encontrado no envio.");
            return res.status(200).send("OK");
        }

        const whatsapp = whatsappRaw.toString().replace(/\D/g, '');
        
        await client.connect();
        const db = client.db('ImperiumDB');
        const colecao = db.collection('clientes');

        const dadosCliente = {
            whatsapp: whatsapp,
            nome: dados.Nome || "Cliente",
            ultima_mensagem: dados.Mensagem || "",
            data_recebimento: new Date()
        };

        await colecao.updateOne(
            { whatsapp: whatsapp },
            { $set: dadosCliente },
            { upsert: true }
        );

        console.log(`✅ [SUCESSO] Cliente ${whatsapp} gravado no banco.`);
        res.status(200).send("OK");
    } catch (error) {
        console.error("❌ Erro no processamento:", error);
        res.status(500).send("Erro Interno");
    }
}

async function consultarCliente(id) {
    try {
        if (!id) return null;
        const busca = id.replace(/\D/g, '');
        
        await client.connect();
        const db = client.db('ImperiumDB');
        const colecao = db.collection('clientes');

        return await colecao.findOne({
            $or: [
                { whatsapp: busca },
                { whatsapp: "55" + busca },
                { whatsapp: busca.startsWith("55") ? busca.substring(2) : busca }
            ]
        });
    } catch (error) {
        console.error("❌ Erro na consulta:", error);
        return null;
    }
}

module.exports = { processarWebhook, consultarCliente };
