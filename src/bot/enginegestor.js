const engine = require('./engine');
const gestorBot = require('./gestor');

/**
 * Esse bot unifica a ativação técnica (Puppeteer) 
 * com o cadastro administrativo (Gestor)
 */
module.exports = async (pedido, status) => {
    try {
        if (status) status.mensagem = "🚀 Iniciando Combo: Cadastro + Ativação";

        // Rodamos os dois processos simultaneamente
        // O engine precisa receber um Array [pedido] como você configurou originalmente
        await Promise.all([
            gestorBot(pedido),
            engine([pedido])
        ]);

        if (status) status.mensagem = "✅ Cliente cadastrado e lista ativada!";
        
    } catch (err) {
        console.error("Erro no EngineGestor:", err.message);
        if (status) status.mensagem = "⚠️ Falha no processo unificado.";
    }
};
