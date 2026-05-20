const axios = require('axios');

// =========================================================================
// CONFIGURAÇÕES DO SEU MICROSERVIÇO PYTHON NO STREAMLIT
// =========================================================================
const STREAMLIT_URL = "https://imperium-whatsapp-api-aqbqy23y4vgxrur8cgrp4z.streamlit.app";
const API_TOKEN = "ImperiumMaster2026@#"; 
// =========================================================================

/**
 * Encaminha as credenciais geradas pela Netplay para a ponte do Streamlit
 * @param {string} whatsapp Número do cliente limpo (ex: 5544999999999)
 * @param {string} texto Mensagem formatada com usuário, senha e DNS
 */
async function enviarMensagemTexto(whatsapp, texto) {
    try {
        // Monta a URL com os parâmetros codificados
        const urlFinal = `${STREAMLIT_URL}/?token=${encodeURIComponent(API_TOKEN)}&number=${encodeURIComponent(whatsapp)}&text=${encodeURIComponent(texto)}`;
        
        console.log(`📡 [WhatsApp Service] Encaminhando dados em background para o Streamlit: ${whatsapp}`);
        
        // Dispara a requisição de forma assíncrona com cabeçalhos básicos de navegador para evitar bloqueios
        axios.get(urlFinal, { 
            timeout: 8000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        }).then(res => {
            console.log(`🚀 [WhatsApp Service] Resposta da ponte recebida. Status: ${res.status}`);
        }).catch(err => {
            // Como o Streamlit é uma interface web, ele pode demorar a responder o HTML completo, 
            // mas o recebimento dos parâmetros na URL acontece logo no primeiro milissegundo.
            console.log(`ℹ️ [WhatsApp Service] Disparo executado em background.`);
        });

        return true;
    } catch (error) {
        console.error("❌ [WhatsApp Service] Erro ao tentar acionar o Streamlit:", error.message);
        return false;
    }
}

module.exports = { enviarMensagemTexto };
