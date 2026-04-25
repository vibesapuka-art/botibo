const engine = require('./engine');
const gestorBot = require('./gestor');

module.exports = async (pedido, status) => {
    try {
        // 1. Mudamos o status para algo que o engine.js NÃO finalize como 'ok'
        status.mensagem = "📡 Passo 1: Ativando no IBO Pro...";
        
        // Executa a ativação técnica
        await engine([pedido]);

        // 2. Após o IBO, forçamos a mensagem e o processo do gestor
        status.mensagem = "📝 Passo 2: Gravando no Gestor...";
        await gestorBot(pedido);

        // 3. AGORA SIM damos o OK final
        status.status = "ok"; 
        status.mensagem = "✅ Ativação e Cadastro concluídos com sucesso!";

    } catch (err) {
        console.error("Erro:", err.message);
        status.status = "erro";
        status.mensagem = "❌ Erro no processo unificado.";
    }
};
