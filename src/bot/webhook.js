const { MongoClient } = require('mongodb');

// String de conexão direta para evitar falhas de variáveis
const uri = "mongodb+srv://vibesapuka_db_user:fG9c7WwavgNkYSoR@cluster0.q3bhsxo.mongodb.net/ImperiumDB?retryWrites=true&w=majority";
const client = new MongoClient(uri);

async function processarWebhook(req, res) {
    try {
        const dados = req.body;
        console.log("📥 DADOS RECEBIDOS:", JSON.stringify(dados));

        // Tenta capturar o WhatsApp em qualquer formato (GestorV3 usa 'WhatsApp')
        const whatsappRaw = dados.WhatsApp || dados.whatsapp || dados.contato;
        
        if (!whatsappRaw) {
            console.log("⚠️ Webhook ignorado: campo de número não localizado.");
            return res.status(200).send("OK");
        }

        const whatsapp = whatsappRaw.toString().replace(/\D/g, '');
        
        await client.connect();
        const db = client.db('ImperiumDB');
        const colecao = db.collection('clientes');

        // Mapeia os campos do GestorV3 (Maiúsculos) ou do seu teste (Minúsculos)
        const dadosCliente = {
            whatsapp: whatsapp,
            nome: dados.Nome || dados.nome || "Cliente Imperium",
            ultima_mensagem: dados.Mensagem || dados.mensagem || "",
            status_pagamento: dados.status_pagamento || "pago",
            vencimento: dados.vencimento || "",
            data_recebimento: new Date()
        };

        await colecao.updateOne(
            { whatsapp: whatsapp },
            { $set: dadosCliente },
            { upsert: true }
        );

        console.log(`✅ [SUCESSO] Cliente ${whatsapp} salvo no MongoDB!`);
        res.status(200).send("OK");
    } catch (error) {
        console.error("❌ ERRO NO WEBHOOK:", error);
        res.status(500).send("Erro");
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
        console.error("❌ ERRO NA CONSULTA:", error);
        return null;
    }
}

module.exports = { processarWebhook, consultarCliente };
