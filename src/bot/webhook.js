const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://vibesapuka_db_user:fG9c7WwavgNkYSoR@cluster0.q3bhsxo.mongodb.net/ImperiumDB?retryWrites=true&w=majority";
const client = new MongoClient(uri);

async function processarWebhook(req, res) {
    try {
        const dados = req.body;
        console.log("📥 Dados recebidos do GestorV3:", JSON.stringify(dados));

        // Captura o WhatsApp exatamente como vem na variável
        const whatsappRaw = dados.whatsapp; 
        
        if (!whatsappRaw) {
            console.log("⚠️ Webhook sem número de WhatsApp.");
            return res.status(200).send("OK");
        }

        const whatsapp = whatsappRaw.toString().replace(/\D/g, '');
        
        await client.connect();
        const db = client.db('ImperiumDB');
        const colecao = db.collection('clientes');

        // Mapeamento baseado nas variáveis reais que você enviou
        const dadosCliente = {
            whatsapp: whatsapp,
            nome: dados.nome_cliente,
            vencimento: dados.vencimento,
            plano: dados.nome_plano,
            valor: dados.valor_plano,
            usuario_iptv: dados.usuario,
            senha_iptv: dados.senha,
            fatura_atual: dados.numero_fatura,
            link_fatura: dados.link_fatura,
            data_atualizacao: new Date()
        };

        // Salva ou atualiza os dados do cliente no banco
        await colecao.updateOne(
            { whatsapp: whatsapp },
            { $set: dadosCliente },
            { upsert: true }
        );

        console.log(`✅ [SUCESSO] Cliente ${dadosCliente.nome} atualizado.`);
        res.status(200).send("OK");
    } catch (error) {
        console.error("❌ Erro no Webhook:", error);
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
        console.error("❌ Erro na consulta:", error);
        return null;
    }
}

module.exports = { processarWebhook, consultarCliente };
