const engine = require('./engine');
const gestorBot = require('./gestor');

/**
 * Super Bot de Janela Única:
 * Economiza memória navegando sequencialmente no mesmo processo.
 */
module.exports = async (pedido, status) => {
    try {
        if (status) status.mensagem = "🚀 Iniciando processo unificado...";

        // 1. Executa primeiro a ativação técnica (Engine)
        // O engine.js já tem a lógica do Puppeteer. 
        // Certifique-se de que ele NÃO feche o browser internamente se você quiser reaproveitar a aba.
        // Se o seu engine.js fecha o browser ao final, o gestorBot precisará abrir um novo,
        // mas eles rodarão um DEPOIS do outro, nunca ao mesmo tempo.
        
        if (status) status.mensagem = "📡 Passo 1/2: Ativando listas no IBO Pro...";
        await engine([pedido]); 

        // 2. Após terminar o IBO Pro, executa o Gestor
        // O processo só chega aqui quando o 'await engine' termina.
        if (status) status.mensagem = "📝 Passo 2/2: Registrando no gestor...";
        await gestorBot(pedido);

        if (status) status.mensagem = "✅ Sucesso! Cadastro e Ativação concluídos.";

    } catch (err) {
        console.error("Erro no EngineGestor:", err.message);
        if (status) status.mensagem = "❌ Erro no fluxo: " + err.message;
    }
};
