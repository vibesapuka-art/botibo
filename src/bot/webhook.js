const mongoose = require('mongoose');

// Link de conexão com a sua senha aplicada
const mongoURI = "mongodb+srv://vibesapuka_db_user:fG9c7WwavgNkYSoR@cluster0.q3bhsxo.mongodb.net/ImperiumDB?retryWrites=true&w=majority";

mongoose.connect(mongoURI)
    .then(() => console.log("✅ Conectado ao MongoDB Atlas com sucesso!"))
    .catch(err => console.error("❌ Erro ao conectar ao MongoDB:", err));

// Modelo de dados do Cliente
const ClienteSchema = new mongoose.Schema({
    identificador: { type: String, unique: true, required: true }, // WhatsApp ou MAC
    nome: String,
    status: String,
    vencimento: String,
    plano: String,
    lastUpdate: { type: Date, default: Date.now }
});

const Cliente = mongoose.model('Cliente', ClienteSchema);

/**
 * processarWebhook
 * Recebe os dados do GestorV3 e salva/atualiza no Banco de Dados
 */
const processarWebhook = async (req, res) => {
    try {
        const dados = req.body;
        // Pega o WhatsApp ou o MAC para usar como ID único
        const whatsapp = dados.whatsapp ? dados.whatsapp.replace(/\D/g, "") : null;
        const mac = dados.mac ? dados.mac.trim().toUpperCase() : null;
        const idPrincipal = whatsapp || mac;

        if (!idPrincipal) {
            console.log("⚠️ Webhook recebido sem WhatsApp ou MAC válido.");
            return res.status(400).send("Sem Identificador");
        }

        // Procura e atualiza, se não existir, cria (upsert)
        await Cliente.findOneAndUpdate(
            { identificador: idPrincipal },
            {
                nome: dados.nome || "Cliente Imperium",
                status: dados.status || "Ativo",
                vencimento: dados.vencimento || "---",
                plano: dados.plano || "Assinatura IPTV",
                lastUpdate: new Date()
            },
            { upsert: true, new: true }
        );

        console.log(`✅ [BANCO] Cliente ${idPrincipal} atualizado.`);
        res.status(200).send("OK");
    } catch (error) {
        console.error("❌ [ERRO WEBHOOK]:", error.message);
        res.status(500).send("Erro interno");
    }
};

/**
 * consultarCliente
 * Busca o cliente no banco de dados para mostrar no seu site
 */
const consultarCliente = async (identificador) => {
    try {
        if (!identificador) return null;
        const busca = identificador.trim().replace(/\D/g, "") || identificador.trim().toUpperCase();
        return await Cliente.findOne({ identificador: busca });
    } catch (error) {
        console.error("❌ [ERRO CONSULTA]:", error.message);
        return null;
    }
};

module.exports = { processarWebhook, consultarCliente };
