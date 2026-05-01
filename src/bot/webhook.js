const { MongoClient } = require('mongodb');

// String de conexão direta para garantir o funcionamento no Render
const uri = "mongodb+srv://vibesapuka_db_user:fG9c7WwavgNkYSoR@cluster0.q3bhsxo.mongodb.net/ImperiumDB?retryWrites=true&w=majority";
const client = new MongoClient(uri);

/**
 * Recebe as notificações de faturas e mensagens do GestorV3
 */
async function processarWebhook(req, res) {
    try {
        const dados = req.body;
        console.log("📥 Dados brutos recebidos do Gestor:", JSON.stringify(dados));

        // O GestorV3 envia os campos com a primeira letra Maiúscula
        const whatsappRaw = dados.WhatsApp || dados.whatsapp;
        
        if (!whatsappRaw) {
            console.log("⚠️ Webhook ignorado: campo WhatsApp não encontrado.");
            return res.status(200).send("OK");
        }

        // Limpa o número deixando apenas dígitos
        const whatsapp = whatsappRaw.toString().replace(/\D/g, '');
        
        await client.connect();
        const db = client.db('ImperiumDB');
        const colecao = db.collection('clientes');

        // Prepara o documento com base nos campos confirmados no texto do GestorV3
        const dadosCliente = {
            whatsapp: whatsapp,
            nome: dados.Nome || "Cliente Imperium",
            ultima_mensagem: dados.Mensagem || "",
            status_sistema: "Ativo",
            data_atualizacao: new Date()
        };

        // Salva ou atualiza os dados do cliente
        await colecao.updateOne(
            { whatsapp: whatsapp },
            { $set: dadosCliente },
            { upsert: true }
        );

        console.log(`✅ [SUCESSO] Dados do cliente ${whatsapp} gravados no banco.`);
        res.status(200).send("OK");
    } catch (error) {
        console.error("❌ Erro ao processar Webhook:", error);
        res.status(500).send("Erro Interno");
    }
}

/**
 * Consulta o cliente no banco quando ele digita o número no site
 */
async function consultarCliente(id) {
    try {
        if (!id) return null;
        const busca = id.replace(/\D/g, '');
        
        await client.connect();
        const db = client.db('ImperiumDB');
        const colecao = db.collection('clientes');

        // Tenta encontrar o número com ou sem o prefixo 55
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
