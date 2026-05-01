const { MongoClient } = require('mongodb');
// Use a sua URL do MongoDB que já funciona
const uri = process.env.MONGO_URI || "sua_string_de_conexao_aqui";
const client = new MongoClient(uri);

async function processarWebhook(req, res) {
    try {
        const dados = req.body;
        console.log("📥 Recebido do GestorV3:", JSON.stringify(dados));

        // Captura o número do WhatsApp (o Gestor usa 'WhatsApp' com W maiúsculo)
        const whatsappRaw = dados.WhatsApp || dados.whatsapp;
        
        if (!whatsappRaw) {
            return res.status(200).send("OK - Sem número");
        }

        const whatsapp = whatsappRaw.toString().replace(/\D/g, '');
        
        await client.connect();
        const db = client.db('ImperiumDB');
        const colecao = db.collection('clientes');

        // Salva os dados conforme o padrão do vídeo
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

        console.log(`✅ Cliente ${whatsapp} atualizado com sucesso.`);
        res.status(200).send("OK");
    } catch (error) {
        console.error("❌ Erro no Webhook:", error);
        res.status(500).send("Erro");
    }
}

async function consultarCliente(id) {
    try {
        const busca = id.replace(/\D/g, '');
        await client.connect();
        const db = client.db('ImperiumDB');
        const colecao = db.collection('clientes');

        return await colecao.findOne({
            $or: [
                { whatsapp: busca },
                { whatsapp: "55" + busca }
            ]
        });
    } catch (error) {
        return null;
    }
}

module.exports = { processarWebhook, consultarCliente };
