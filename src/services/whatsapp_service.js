const axios = require('axios');

// =========================================================================
// CONFIGURAÇÕES DO SEU MICROSERVIÇO PYTHON NO STREAMLIT
// =========================================================================
const STREAMLIT_URL = "https://imperium-whatsapp-api-aqbqy23y4vgxrur8cgrp4z.streamlit.app";
const API_TOKEN = "ImperiumMaster2026@#"; // Mesma senha que colocamos no Python
// =========================================================================

/**
 * Encaminha as credenciais geradas pela Netplay para a ponte do Streamlit
 * @param {string} whatsapp Número do cliente limpo (ex: 5544999999999)
 * @param {string} texto Mensagem formatada com usuário, senha e DNS
 */
async function enviarMensagemTexto(whatsapp, texto) {
    try {
        // encodeURIComponent é fundamental aqui! Ele transforma as quebras de linha (\n)
        // e espaços da mensagem em um formato que a URL aceita sem quebrar o envio.
        const urlFinal = `${STREAMLIT_URL}/?token=${API_TOKEN}&number=${whatsapp}&text=${encodeURIComponent(texto)}`;
        
        console.log(`📡 [WhatsApp Service] Encaminhando dados para o Streamlit: ${whatsapp}`);
        
        // Faz o disparo invisível (GET) para o seu Streamlit capturar
        const response = await axios.get(urlFinal, { timeout: 10000 });
        
        if (response.status === 200) {
            console.log(`🚀 [WhatsApp Service] Transação entregue com sucesso para a ponte Python!`);
            return true;
        }
        return false;
    } catch (error) {
        console.error("❌ [WhatsApp Service] Erro crítico ao conectar com o Streamlit:", error.message);
        return false;
    }
}

module.exports = { enviarMensagemTexto };
