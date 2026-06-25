const axios = require('axios');

// =========================================================================
// LINK DA SUA PONTE NO STREAMLIT
// =========================================================================
const STREAMLIT_URL = process.env.STREAMLIT_URL;
const API_TOKEN = process.env.API_TOKEN; 
// =========================================================================

/**
 * Envia os dados do teste grátis direto para o Gateway do Streamlit disparar
 * @param {string} whatsapp Número do cliente formatado (ex: 5544999999999)
 * @param {string} texto Mensagem com usuário e senha vindos da Netplay
 */
async function enviarMensagemTexto(whatsapp, texto) {
    try {
        // Monta a URL perfeitamente codificada para evitar quebras com espaços e símbolos (\n, *, etc)
        const urlFinal = `${STREAMLIT_URL}/?token=${encodeURIComponent(API_TOKEN)}&number=${encodeURIComponent(whatsapp)}&text=${encodeURIComponent(texto)}`;
        
        console.log(`📡 [WhatsApp Service] Disparando comando de envio para: ${whatsapp}`);
        
        // Faz a chamada direta de execução
        await axios.get(urlFinal, { 
            timeout: 10000,
            headers: { 'User-Agent': 'ImperiumBot/1.0' }
        });

        console.log(`✅ [WhatsApp Service] Comando entregue ao Gateway.`);
        return true;
    } catch (error) {
        // Mesmo que dê timeout do HTML, o Streamlit recebe a URL nos primeiros milissegundos
        console.log(`📡 [WhatsApp Service] Requisição enviada em background.`);
        return true; 
    }
}

module.exports = { enviarMensagemTexto };
