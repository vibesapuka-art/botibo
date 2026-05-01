const { MongoClient } = require('mongodb');

// Ligação direta ao ImperiumDB
const uri = "mongodb+srv://vibesapuka_db_user:fG9c7WwavgNkYSoR@cluster0.q3bhsxo.mongodb.net/ImperiumDB?retryWrites=true&w=majority";
const client = new MongoClient(uri);

async function processarWebhook(req, res) {
    try {
        const dados = req.body;
        console.log("📥 DADOS RECEBIDOS:", JSON.stringify(dados));

        // Usa a variável 'whatsapp' que confirmamos no Webhook.site
        const whatsappRaw = dados.whatsapp;
        
        if (!whatsappRaw) {
            console.log("⚠️ Webhook ignorado: campo 'whatsapp' não encontrado.");
            return res.status(200).send("OK");
        }

        const whatsapp = whatsappRaw.toString().replace(/\D/g, '');
        
        await client.connect();
        const db = client.db('ImperiumDB');
        const colecao = db.collection('clientes');

        // Mapeamento das variáveis reais do GestorV3
        const dadosCliente = {
            whatsapp: whatsapp,
            nome: dados.nome_cliente || "Cliente",
            vencimento: dados.vencimento || "",
            usuario_iptv: dados.usuario || "",
            senha_iptv: dados.senha || "",
            plano: dados.nome_plano || "",
            valor: dados.valor_plano || "",
            data_atualizacao: new Date()
        };

        await colecao.updateOne(
            { whatsapp: whatsapp },
            { $set: dadosCliente },
            { upsert: true }
        );

        console.log(`✅ [SUCESSO] Cliente ${whatsapp} guardado no ImperiumDB.`);
        res.status(200).send("OK");
    } catch (error) {
        console.error("❌ ERRO NO PROCESSAMENTO:", error);
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
