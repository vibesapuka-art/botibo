// webhook.js

// Banco de dados temporário (em memória)
// Para um sistema que não reinicia muito, isso funciona bem.
let bancoDadosClientes = {};

/**
 * processarWebhook
 * Esta função recebe as notificações do GestorV3 (IDs 5, 6, 8, etc.)
 */
const processarWebhook = (req, res) => {
    try {
        const dados = req.body;
        
        // O GestorV3 envia os dados. Vamos tentar pegar o identificador principal.
        // Pode vir como 'whatsapp', 'mac', ou 'cliente_id' dependendo da sua config no Gestor
        const whatsapp = dados.whatsapp ? dados.whatsapp.replace(/\D/g, "") : null;
        const mac = dados.mac ? dados.mac.trim().toUpperCase() : null;

        const idPrincipal = whatsapp || mac;

        if (!idPrincipal) {
            console.log("⚠️ [WEBHOOK] Recebido, mas sem WhatsApp ou MAC para identificar.");
            return res.status(400).send("Identificador não encontrado.");
        }

        // Mapeamento dos dados que o GestorV3 envia
        // Ajuste os nomes dos campos (dados.nome, dados.vencimento) conforme seu painel
        bancoDadosClientes[idPrincipal] = {
            nome: dados.nome || "Cliente Imperium",
            status: dados.status || "Ativo", // Ex: Ativo, Vencido, Bloqueado
            vencimento: dados.vencimento || "---",
            plano: dados.plano || "Assinatura TV",
            lastUpdate: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
        };

        console.log(`✅ [WEBHOOK] Cliente Atualizado: ${idPrincipal} | Status: ${dados.status}`);
        
        // Responde 200 para o GestorV3 não achar que deu erro e reenviar
        res.status(200).send("Webhook processado com sucesso!");

    } catch (error) {
        console.error("❌ [ERRO WEBHOOK]:", error.message);
        res.status(500).send("Erro interno ao processar.");
    }
};

/**
 * consultarCliente
 * Função que o seu index.js vai chamar quando o cliente digitar no site
 */
const consultarCliente = (identificador) => {
    if (!identificador) return null;
    
    // Limpa o que o usuário digitar (remove espaços ou caracteres de Whats)
    const busca = identificador.trim().replace(/\D/g, "") || identificador.trim().toUpperCase();
    
    return bancoDadosClientes[busca] || null;
};

module.exports = { processarWebhook, consultarCliente };
