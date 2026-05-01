const { MongoClient } = require('mongodb');
const uri = process.env.MONGO_URL;

/**
 * Função para buscar os dados do cliente no MongoDB
 */
async function consultarCliente(numeroWhatsApp) {
    if (!uri) throw new Error("MONGO_URL não configurada.");
    const client = new MongoClient(uri);
    try {
        let numeroLimpo = numeroWhatsApp.replace(/\D/g, '');
        await client.connect();
        const db = client.db("ImperiumDB");
        const colecao = db.collection("clientes");

        // Tenta buscar com e sem o prefixo 55
        let tentativas = [numeroLimpo];
        if (numeroLimpo.startsWith('55')) {
            tentativas.push(numeroLimpo.substring(2));
        } else {
            tentativas.push('55' + numeroLimpo);
        }

        return await colecao.findOne({ whatsapp: { $in: tentativas } });
    } catch (err) {
        console.error("❌ Erro ao consultar MongoDB:", err.message);
        throw err;
    } finally {
        await client.close();
    }
}

/**
 * Função que recebe os dados do GestorV3 via POST
 */
async function processarWebhook(req, res) {
    if (!uri) {
        console.error("❌ Erro: Variável MONGO_URL não definida no ambiente.");
        return res.status(500).send("Sem URL do Banco");
    }

    const client = new MongoClient(uri);
    try {
        const d = req.body; 
        
        // Verifica se recebemos o dado principal (WhatsApp)
        if (!d.whatsapp) {
            console.log("⚠️ Webhook recebido, mas sem campo WhatsApp. Verifique as variáveis do Gestor.");
            return res.status(200).send("Recebido, mas sem WhatsApp"); 
        }

        // Mapeamento inteligente: tenta pegar o dado de vários nomes possíveis
        const clienteData = {
            whatsapp: d.whatsapp.replace(/\D/g, ''),
            nome: d.nome_cliente || d.nome || d.cliente || 'Cliente Imperium',
            usuario_iptv: d.usuario || d.usuario_iptv || d.login || '',
            senha_iptv: d.senha || d.senha_iptv || d.password || '',
            vencimento: d.vencimento || d.data_vencimento || d.expiracao || '',
            valor: d.valor_plano || d.valor || d.preco || '',
            servidor: d.nome_servidor || d.servidor || 'MultServidor',
            link_fatura: d.link_fatura || d.fatura_link || d.url_fatura || '',
            status_fatura: d.status_fatura || d.status || 'Pendente',
            data_atualizacao: new Date()
        };

        await client.connect();
        const db = client.db("ImperiumDB");
        const colecao = db.collection("clientes");

        // Salva ou Atualiza (upsert) baseado no número do WhatsApp
        await colecao.updateOne(
            { whatsapp: clienteData.whatsapp },
            { $set: clienteData },
            { upsert: true }
        );

        console.log(`✅ Sucesso: Cliente ${clienteData.whatsapp} (${clienteData.nome}) salvo no banco.`);
        res.status(200).send("OK");

    } catch (err) {
        console.error("❌ Erro crítico no processamento do Webhook:", err.message);
        res.status(500).send("Erro interno: " + err.message);
    } finally {
        await client.close();
    }
}

module.exports = { processarWebhook, consultarCliente };
