const axios = require('axios');

const STREAMLIT_URL = "https://imperium-whatsapp-api-aqbqy23y4vgxrur8cgrp4z.streamlit.app"; // URL que o Streamlit vai te dar
const API_TOKEN = "ImperiumMaster2026@#"; // A mesma senha que colocamos no Python

async function enviarMensagemTexto(whatsapp, texto) {
    try {
        // O Streamlit recebe dados via GET através da URL
        // Usamos encodeURIComponent para que o texto da mensagem (com quebras de linha) não quebre a URL
        const urlFinal = `${STREAMLIT_URL}/?token=${API_TOKEN}&number=${whatsapp}&text=${encodeURIComponent(texto)}`;
        
        console.log(`📤 Enviando para Streamlit: ${whatsapp}`);
        
        await axios.get(urlFinal);
        return true;
    } catch (error) {
        console.error("❌ Erro ao enviar para o Streamlit:", error.message);
        return false;
    }
}

module.exports = { enviarMensagemTexto };
