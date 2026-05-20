const axios = require('axios');

// =========================================================================
// CONFIGURAÇÕES DA SUA EVOLUTION API (CONECTADA AO MONGODB NO RENDER)
// =========================================================================
const EVOLUTION_API_URL = "https://botibo.onrender.com"; // URL do seu Render
const EVOLUTION_INSTANCIA = "ImperiumBot";               // Nome da instância que você criou nela
const EVOLUTION_API_KEY = "SEU_TOKEN_DA_EVOLUTION";       // Token global (apikey) definido no Render
// =========================================================================

/**
 * Envia mensagem de texto formatada simulando ação humana ("Digitando...")
 * @param {string} whatsapp Destinatário com código de país e DDD (ex: 5544999999999)
 * @param {string} texto Mensagem que será entregue
 * @returns {Promise<boolean>} Retorna true se enviado com sucesso
 */
async function enviarMensagemTexto(whatsapp, texto) {
    try {
        console.log(`📤 [Svc WhatsApp] Iniciando disparo para: ${whatsapp}`);
        
        const payload = {
            number: whatsapp,
            options: {
                delay: 2500,          // Aguarda 2.5 segundos simulando digitação natural
                presence: "composing"  // Exibe "Digitando..." no topo do WhatsApp do cliente
            },
            textMessage: {
                text: texto
            }
        };

        const response = await axios.post(
            `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCIA}`, 
            payload, 
            {
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': EVOLUTION_API_KEY
                },
                timeout: 8000 // Tempo limite para o Render responder
            }
        );

        if (response.status === 200 || response.status === 201) {
            console.log(`🚀 [Svc WhatsApp] Transação concluída com sucesso para: ${whatsapp}`);
            return true;
        }
        
        return false;
    } catch (error) {
        console.error(`❌ [Svc WhatsApp] Falha na transação de envio:`, error.message);
        return false;
    }
}

module.exports = { enviarMensagemTexto };
