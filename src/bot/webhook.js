const mongoose = require('mongoose');

// Link de conexão com a sua senha aplicada
const mongoURI = "mongodb+srv://vibesapuka_db_user:fG9c7WwavgNkYSoR@cluster0.q3bhsxo.mongodb.net/ImperiumDB?retryWrites=true&w=majority";

mongoose.connect(mongoURI)
    .then(() => console.log("✅ Conectado ao MongoDB Atlas com sucesso!"))
    .catch(err => console.error("❌ Erro ao conectar ao MongoDB:", err));

// Modelo de dados do Cliente
const ClienteSchema = new mongoose.Schema({
    identificador: { type: String, unique: true, required: true },
    nome: String,
    status: String,
    vencimento: String,
    plano: String,
    lastUpdate: { type: Date, default: Date.now }
});

const Cliente = mongoose.model('Cliente', ClienteSchema);

/**
 * processarWebhook
 * Agora aceita 'contato', 'whatsapp' ou 'telefone'
 */
const processarWebhook = async (req, res) => {
    try {
        const dados = req.body;
        console.log("📥 Webhook Recebido:", JSON.stringify(dados));

        // Tenta encontrar o número do cliente em vários campos possíveis
        const telBruto = dados.whatsapp || dados.contato || dados.telefone || dados.celular || "";
        const whatsapp = telBruto ? telBruto.toString().replace(/\D/g, "") : null;
        
        // Tenta encontrar o MAC
        const mac = dados.mac ? dados.mac.trim().toUpperCase() : null;
        
        // Identificador final (prioriza WhatsApp, depois MAC)
        const idPrincipal = whatsapp || mac;

        if (!idPrincipal) {
            console.log("⚠️ Webhook ignorado: Nenhum WhatsApp ou MAC encontrado nos dados.");
            return res.status(400).send("Identificador ausente");
        }

        // Salva ou Atualiza
        await Cliente.findOneAndUpdate(
            { identificador: idPrincipal },
            {
                nome: dados.nome || dados.cliente_nome || "Cliente Imperium",
                status: dados.status || "Ativo",
                vencimento: dados.vencimento || dados.data_vencimento || "---",
                plano: dados.plano || "Assinatura IPTV",
                lastUpdate: new Date()
            },
            { upsert: true, new: true }
        );

        console.log(`✅ [BANCO] Cliente ${idPrincipal} sincronizado.`);
        res.status(200).send("OK");
    } catch (error) {
        console.error("❌ [ERRO WEBHOOK]:", error.message);
        res.status(500).send("Erro interno");
    }
};

/**
 * consultarCliente
 * Busca flexível (aceita o que o usuário digitar)
 */
const consultarCliente = async (identificador) => {
    try {
        if (!identificador) return null;
        const busca = identificador.trim();
        
        // Busca 1: Exatamente como digitado (bom para MAC)
        let resultado = await Cliente.findOne({ identificador: busca });

        // Busca 2: Apenas números (bom para WhatsApp)
        if (!resultado) {
            const apenasNumeros = identificador.replace(/\D/g, "");
            resultado = await Cliente.findOne({ identificador: apenasNumeros });
        }

        return resultado;
    } catch (error) {
        console.error("❌ [ERRO CONSULTA]:", error.message);
        return null;
    }
};

module.exports = { processarWebhook, consultarCliente };
