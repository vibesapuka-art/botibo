const axios = require('axios');

/**
 * Controla a geração de testes automáticos via painel vinculando ao qpainel da Netplay
 */
async function gerarTesteGratis(req, res) {
    const { whatsapp, tipoTeste, nomeCliente, termoAceito } = req.body;

    // 1. Validação de segurança básica
    if (!whatsapp) {
        return res.json({ success: false, mensagem: "O número de WhatsApp é obrigatório para evitar papa-testes." });
    }

    if (!termoAceito) {
        return res.json({ success: false, mensagem: "O cliente precisa aceitar os termos do aplicativo para prosseguir." });
    }

    // 2. Define os endpoints do Botbot da Netplay (Com ou Sem Adulto)
    let urlNetplay = "https://netplay.mplll.com/api/chatbot/ANKWPy01PR/we6Wn50DK8"; // Sem Adulto
    if (tipoTeste === 'com_adulto') {
        urlNetplay = "https://netplay.mplll.com/api/chatbot/ANKWPy01PR/bOxLA7yWZ7"; // Com Adulto
    }

    try {
        console.log(`📡 [Teste Grátis] Solicitando na Netplay para: ${whatsapp} | Tipo: ${tipoTeste}`);

        // 3. Dispara os dados para a API da Netplay registrar no qpainel
        const respostaNetplay = await axios.post(urlNetplay, {
            phone: whatsapp,
            name: nomeCliente || "Cliente do Painel"
        });

        const { username, password, dns, package: nomePacote, expiresAtFormatted } = respostaNetplay.data;

        // 4. Se a Netplay recusar (número duplicado ou limite estourado)
        if (!username || !password) {
            return res.json({ 
                success: false, 
                mensagem: "Não foi possível gerar. Este número pode já ter consumido um teste recente ou o painel atingiu o limite de créditos." 
            });
        }

        // 5. Devolve as credenciais com sucesso para o front-end montar o tutorial do cliente
        return res.json({
            success: true,
            mensagem: "Teste gerado e vinculado com sucesso!",
            dados: {
                username,
                password,
                dns: dns || 'http://galaxy.blcplay.com',
                pacote: nomePacote,
                validade: expiresAtFormatted
            }
        });

    } catch (error) {
        console.error("❌ Erro ao processar teste_gratis:", error.message);
        return res.status(500).json({ 
            success: false, 
            mensagem: "Erro ao se conectar com o servidor da Netplay: " + error.message 
        });
    }
}

module.exports = { gerarTesteGratis };
