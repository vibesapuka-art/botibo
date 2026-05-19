const axios = require('axios');

/**
 * Controla a geração de testes automáticos integrados à API da Netplay
 */
async function gerarTesteGratis(req, res) {
    console.log("\n============================================================");
    console.log("📥 [BACKEND LOG] REQUISIÇÃO RECEBIDA EM /api/teste-gratis");
    console.log("👉 Dados recebidos (req.body):", JSON.stringify(req.body, null, 2));
    console.log("============================================================");

    const { whatsapp, tipoTeste, nomeCliente } = req.body;

    // 1. Validação básica de campo obrigatório
    if (!whatsapp) {
        console.error("❌ [BACKEND] Número de WhatsApp ausente.");
        return res.json({ success: false, mensagem: "O número de WhatsApp é obrigatório para gerar o teste." });
    }

    // 2. Definição da URL da Netplay com base na escolha do cliente
    let urlNetplay = "https://netplay.mplll.com/api/chatbot/ANKWPy01PR/we6Wn50DK8"; // Sem Adulto
    if (tipoTeste === 'com_adulto') {
        urlNetplay = "https://netplay.mplll.com/api/chatbot/ANKWPy01PR/bOxLA7yWZ7"; // Com Adulto
    }

    console.log(`🛰️ [BACKEND] Endpoint Netplay: ${urlNetplay}`);
    
    // Configuração dos parâmetros aceitos nativamente pelo painel da Netplay
    const payloadNetplay = {
        phone: whatsapp,
        name: nomeCliente || "Cliente do Painel"
    };

    try {
        console.log("📤 [BACKEND] Enviando dados para a Netplay...");
        const respostaNetplay = await axios.post(urlNetplay, payloadNetplay);

        console.log("✨ [BACKEND] Status Netplay:", respostaNetplay.status);
        console.log("📦 [BACKEND] Retorno Netplay:", JSON.stringify(respostaNetplay.data, null, 2));

        const { username, password, dns, package: nomePacote, expiresAtFormatted } = respostaNetplay.data;

        // 4. Verificação de integridade das credenciais entregues
        if (!username || !password) {
            console.warn("⚠️ [BACKEND] Netplay não retornou credenciais válidas.");
            return res.json({ 
                success: false, 
                mensagem: "Não foi possível gerar o teste. Verifique se o número já possui teste recente ou o saldo do painel." 
            });
        }

        console.log(`✅ [BACKEND] Sucesso! User: ${username} | Pass: ${password}`);
        
        return res.json({
            success: true,
            mensagem: "Teste gerado com sucesso!",
            dados: {
                username,
                password,
                dns: dns || 'http://galaxy.blcplay.com',
                pacote: nomePacote,
                validade: expiresAtFormatted
            }
        });

    } catch (error) {
        console.error("❌ [BACKEND] Erro crítico na API Netplay:", error.message);

        if (error.response) {
            console.error("👉 Resposta de Erro da Netplay:", JSON.stringify(error.response.data, null, 2));
        }

        return res.status(500).json({ 
            success: false, 
            mensagem: "Erro ao se conectar com o servidor da Netplay: " + error.message 
        });
    }
}

module.exports = { gerarTesteGratis };
