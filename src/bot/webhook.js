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
 * AJUSTADO: Agora aceita "WhatsApp" (com W maiúsculo) e outros formatos do GestorV3
 */
const processarWebhook = async (req, res) => {
    try {
        const dados = req.body;
        console.log("📥 Dados recebidos do Gestor:", JSON.stringify(dados));

        // Captura o número do WhatsApp ignorando maiúsculas/minúsculas
        const telBruto = dados.WhatsApp || dados.whatsapp || dados.contato || dados.telefone || "";
        const identificadorFinal = telBruto.toString().replace(/\D/g, "");

        if (!identificadorFinal) {
            console.log("⚠️ Nenhum número de WhatsApp encontrado no envio.");
            return res.status(400).send("Sem Identificador");
        }

        // Salva ou atualiza os dados no banco
        await Cliente.findOneAndUpdate(
            { identificador: identificadorFinal },
            {
                nome: dados.Cliente || dados.nome || "Cliente Imperium",
                status: "Ativo",
                vencimento: dados.vencimento || "Verificar no Painel",
                plano: dados.plano || "Assinatura IPTV",
                lastUpdate: new Date()
            },
            { upsert: true, new: true }
        );

        console.log(`✅ [SUCESSO] Cliente ${identificadorFinal} gravado no banco.`);
        res.status(200).send("OK");
    } catch (error) {
        console.error("❌ [ERRO NO PROCESSAMENTO]:", error.message);
        res.status(500).send("Erro interno");
    }
};

/**
 * consultarCliente
 * Ajustado para buscar pelo número exato enviado pelo gestor
 */
const consultarCliente = async (identificador) => {
    try {
        if (!identificador) return null;
        const busca = identificador.trim().replace(/\D/g, ""); // Busca apenas os números
        return await Cliente.findOne({ identificador: busca });
    } catch (error) {
        console.error("❌ [ERRO NA CONSULTA]:", error.message);
        return null;
    }
};

module.exports = { processarWebhook, consultarCliente };
