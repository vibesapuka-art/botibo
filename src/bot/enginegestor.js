const engine = require('./engine');
const gestorBot = require('./gestor');

module.exports = async (pedido, status) => {
    try {
        if (status) status.mensagem = "📡 Iniciando: Ativação + Cadastro...";

        // 1. Executamos primeiro a parte técnica (IBO Pro)
        // Usamos 'await' para o código não passar para a próxima linha até o engine terminar
        await engine([pedido]); 
        
        // 2. Agora que o IBO Pro terminou, chamamos o Gestor
        if (status) status.mensagem = "📝 Ativado! Agora registrando no gestor...";
        
        // AGUARDAR O GESTOR: Isso é o que estava faltando
        await gestorBot(pedido);

        if (status) {
            status.status = "ok";
            status.mensagem = "✅ Tudo pronto! Cadastro e Ativação concluídos.";
        }

    } catch (err) {
        console.error("Erro no fluxo unificado:", err.message);
        if (status) {
            status.status = "erro";
            status.mensagem = "⚠️ Houve um problema no processo.";
        }
    }
};
