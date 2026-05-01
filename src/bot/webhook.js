const { MongoClient } = require('mongodb');

// URL de conexão (Certifique-se de que a variável de ambiente MONGO_URL esteja configurada no Render)
const uri = process.env.MONGO_URL;
const client = new MongoClient(uri);

/**
 * Processa os dados recebidos do Webhook do GestorV3
 */
async function processarWebhook(req, res) {
    try {
        const dados = req.body;

        // Mapeia os campos do GestorV3 para o seu banco ImperiumDB
        const clienteData = {
            whatsapp: dados.whatsapp ? dados.whatsapp.replace(/\D/g, '') : '', // Remove caracteres não numéricos
            nome: dados.nome || 'Cliente Novo',
            plano: dados.plano || '',
            usuario_iptv: dados.login_usuario || dados.usuario || '',
            senha_iptv: dados.senha_usuario || dados.senha || '',
            vencimento: dados.data_vencimento || '',
            valor: dados.valor_plano || '',
            link_fatura: dados.link_fatura || '',
            data_atualizacao: new Date()
        };

        await client.connect();
        const db = client.db("ImperiumDB");
        const colecao = db.collection("clientes");

        // Salva ou atualiza os dados do cliente usando o WhatsApp como chave única
        await colecao.updateOne(
            { whatsapp: clienteData.whatsapp },
            { $set: clienteData },
            { upsert: true }
        );

        console.log(`✅ Dados do cliente ${clienteData.nome} atualizados via Webhook.`);
        res.status(200).send("Webhook recebido com sucesso!");

    } catch (error) {
        console.error("❌ Erro ao processar Webhook:", error);
        res.status(500).send("Erro interno ao salvar dados.");
    } finally {
        await client.close();
    }
}

/**
 * Consulta o cliente no MongoDB pelo número de WhatsApp
 */
async function consultarCliente(numeroWhatsApp) {
    try {
        // Limpa o número para garantir que a busca seja apenas numérica
        const numeroLimpo = numeroWhatsApp.replace(/\D/g, '');
        
        await client.connect();
        const db = client.db("ImperiumDB");
        const colecao = db.collection("clientes");

        // Busca exata pelo campo 'whatsapp' conforme visto no seu Atlas
        const cliente = await colecao.findOne({ whatsapp: numeroLimpo });

        if (cliente) {
            console.log(`🔎 Cliente localizado: ${cliente.nome}`);
            return cliente;
        } else {
            console.log(`⚠️ Nenhum cliente encontrado para o número: ${numeroLimpo}`);
            return null;
        }

    } catch (error) {
        console.error("❌ Erro na consulta ao MongoDB:", error);
        throw error;
    } finally {
        await client.close();
    }
}

module.exports = {
    processarWebhook,
    consultarCliente
};
