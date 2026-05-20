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
    if (tipoTeste === 'com_adulto' || tipoTeste === 'com_adulto🔥') {
        urlNetplay = "https://netplay.mplll.com/api/chatbot/ANKWPy01PR/bOxLA7yWZ7"; // Com Adulto
    }

    try {
        console.log(`📡 [Teste Grátis] Solicitando na Netplay para: ${whatsapp} | Tipo: ${tipoTeste}`);

        // 3. Dispara os dados para a API da Netplay registrar no qpainel
        const respostaNetplay = await axios.post(urlNetplay, {
            phone: whatsapp,
            name: nomeCliente || "Cliente do Painel"
        }, {
            timeout: 15000 // 15 segundos de limite para evitar travamentos
        });

        // LOG CRUCIAL: Mostra exatamente o que a Netplay respondeu para você ver no terminal do Render
        console.log("📥 [Netplay Resposta Bruta]:", JSON.stringify(respostaNetplay.data));

        // Tenta capturar os dados tanto da raiz quanto de uma propriedade interna (caso mude)
        const dadosNetplay = respostaNetplay.data || {};
        const username = dadosNetplay.username || (dadosNetplay.dados && dadosNetplay.dados.username);
        const password = dadosNetplay.password || (dadosNetplay.dados && dadosNetplay.dados.password);
        const dns = dadosNetplay.dns || (dadosNetplay.dados && dadosNetplay.dados.dns) || 'http://galaxy.blcplay.com';
        const nomePacote = dadosNetplay.package || dadosNetplay.pacote || "Teste Grátis";
        const expiresAtFormatted = dadosNetplay.expiresAtFormatted || dadosNetplay.validade || "6 Horas";

        // 4. Se a Netplay não devolver as credenciais essenciais
        if (!username || !password) {
            console.log(`⚠️ [Teste Grátis] Netplay não retornou usuário/senha válidos para o número ${whatsapp}`);
            return res.json({ 
                success: false, 
                mensagem: "Não foi possível gerar as credenciais. Este número pode já ter consumido um teste recente ou o limite do painel estourou." 
            });
        }

        // 5. Devolve as credenciais com sucesso para o front-end montar o tutorial do cliente
        console.log(`✅ [Teste Grátis] Sucesso para ${whatsapp}! Usuário: ${username}`);
        return res.json({
            success: true,
            mensagem: "Teste gerado e vinculado com sucesso!",
            dados: {
                username,
                password,
                dns,
                pacote: nomePacote,
                validade: expiresAtFormatted
            }
        });

    } catch (error) {
        console.error("❌ Erro ao processar teste_gratis:", error.message);
        
        if (error.response) {
            console.error("📦 Detalhes do erro do servidor Netplay:", JSON.stringify(error.response.data));
        }

        return res.status(500).json({ 
            success: false, 
            mensagem: "Erro ao se conectar com o servidor da Netplay: " + error.message 
        });
    }
}

module.exports = { gerarTesteGratis };
