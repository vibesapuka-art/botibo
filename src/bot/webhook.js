const { MongoClient } = require('mongodb');

// Configuração do Banco de Dados ImperiumDB
const uri = "mongodb+srv://vibesapuka_db_user:fG9c7WwavgNkYSoR@cluster0.q3bhsxo.mongodb.net/ImperiumDB?retryWrites=true&w=majority";
const client = new MongoClient(uri);

/**
 * 1. PROCESSAR WEBHOOK (Recebe dados do GestorV3)
 * Este bloco salva os dados sempre que algo acontece no GestorV3.
 */
async function processarWebhook(req, res) {
    try {
        const dados = req.body;
        console.log("📥 DADOS DO GESTOR RECEBIDOS:", JSON.stringify(dados));

        const whatsappRaw = dados.whatsapp;
        
        if (!whatsappRaw) {
            console.log("⚠️ Webhook ignorado: campo 'whatsapp' ausente.");
            return res.status(200).send("OK");
        }

        // Limpa o número para salvar apenas dígitos
        const whatsapp = whatsappRaw.toString().replace(/\D/g, '');
        
        await client.connect();
        const db = client.db('ImperiumDB');
        const colecao = db.collection('clientes');

        // MAPEAMENTO DAS VARIÁVEIS REAIS DO GESTORV3
        const dadosCliente = {
            whatsapp: whatsapp,
            nome: dados.nome_cliente || "Cliente Imperium",
            vencimento: dados.vencimento || "A definir",
            usuario_iptv: dados.usuario || "Gerando...",
            senha_iptv: dados.senha || "Gerando...",
            plano: dados.nome_plano || "Nenhum plano ativo",
            valor: dados.valor_plano || "R$ 0,00",
            link_fatura: dados.link_fatura || "",
            data_atualizacao: new Date()
        };

        // Salva ou atualiza no MongoDB
        await colecao.updateOne(
            { whatsapp: whatsapp },
            { $set: dadosCliente },
            { upsert: true }
        );

        console.log(`✅ [SUCESSO] Dados de ${whatsapp} atualizados no banco.`);
        res.status(200).send("OK");
    } catch (error) {
        console.error("❌ ERRO NO PROCESSAMENTO DO WEBHOOK:", error);
        res.status(500).send("Erro Interno");
    }
}

/**
 * 2. CONSULTAR CLIENTE (Envia dados para o seu Painel Web)
 * Este bloco é usado quando o cliente clica em "Verificar Status".
 */
async function consultarCliente(id) {
    try {
        if (!id) return null;
        
        // Limpa o ID/WhatsApp para a busca
        const busca = id.toString().replace(/\D/g, '');
        
        await client.connect();
        const db = client.db('ImperiumDB');
        const colecao = db.collection('clientes');

        // Busca flexível (tenta encontrar com ou sem o 55 do Brasil)
        const cliente = await colecao.findOne({
            $or: [
                { whatsapp: busca },
                { whatsapp: "55" + busca },
                { whatsapp: busca.startsWith("55") ? busca.substring(2) : busca }
            ]
        });

        if (!cliente) return null;

        // Retorna apenas os campos que o seu painel vai exibir
        return {
            nome: cliente.nome,
            usuario_iptv: cliente.usuario_iptv,
            senha_iptv: cliente.senha_iptv,
            vencimento: cliente.vencimento,
            valor: cliente.valor,
            link_fatura: cliente.link_fatura,
            plano: cliente.plano
        };
    } catch (error) {
        console.error("❌ ERRO NA CONSULTA AO BANCO:", error);
        return null;
    }
}

module.exports = { processarWebhook, consultarCliente };
