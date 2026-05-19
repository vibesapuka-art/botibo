const axios = require('axios');

/**
 * Controla a geração de testes automáticos com logs detalhados de depuração
 */
async function gerarTesteGratis(req, res) {
    console.log("\n============================================================");
    console.log("📥 [BACKEND LOG] REQUISIÇÃO RECEBIDA EM /api/teste-gratis");
    console.log("👉 Corpo completo da requisição (req.body):", JSON.stringify(req.body, null, 2));
    console.log("============================================================");

    const { whatsapp, tipoTeste, nomeCliente } = req.body;

    // 1. Validação básica de campo obrigatório
    if (!whatsapp) {
        console.error("❌ [BACKEND LOG] Validação falhou: Número de WhatsApp está ausente.");
        return res.json({ success: false, mensagem: "O número de WhatsApp é obrigatório para gerar o teste." });
    }

    // 2. Determinação da URL da Netplay
    let urlNetplay = "https://netplay.mplll.com/api/chatbot/ANKWPy01PR/we6Wn50DK8"; // Sem Adulto
    if (tipoTeste === 'com_adulto') {
        urlNetplay = "https://netplay.mplll.com/api/chatbot/ANKWPy01PR/bOxLA7yWZ7"; // Com Adulto
    }

    console.log(`🛰️ [BACKEND LOG] URL selecionada da Netplay: ${urlNetplay}`);
    
    // Montagem dos dados que serão disparados para o painel externo
    const payloadNetplay = {
        phone: whatsapp,
        name: nomeCliente || "Cliente do Painel"
    };

    console.log("📤 [BACKEND LOG] Disparando POST para a Netplay com dados:", JSON.stringify(payloadNetplay, null, 2));

    try {
        const respostaNetplay = await axios.post(urlNetplay, payloadNetplay);

        console.log("✨ [BACKEND LOG] Netplay respondeu com status HTTP:", respostaNetplay.status);
        console.log("📦 [BACKEND LOG] Dados brutos retornados pela Netplay:", JSON.stringify(respostaNetplay.data, null, 2));

        const { username, password, dns, package: nomePacote, expiresAtFormatted } = respostaNetplay.data;

        // 4. Validação do retorno da API
        if (!username || !password) {
            console.warn("⚠️ [BACKEND LOG] Netplay respondeu com sucesso HTTP, mas os campos 'username' ou 'password' vieram vazios!");
            return res.json({ 
                success: false, 
                mensagem: "Não foi possível gerar o teste. Verifique se o número já possui teste ativo ou se há saldo no painel." 
            });
        }

        console.log(`✅ [BACKEND LOG] Teste criado com sucesso! User: ${username} | Pass: ${password}`);
        
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
        console.error("❌ [BACKEND LOG] Erro catastrófico ao chamar a API da Netplay!");
        console.error("👉 Mensagem do Erro:", error.message);

        if (error.response) {
            console.error("👉 Status de Erro da Netplay:", error.response.status);
            console.error("👉 Detalhes/Corpo do erro retornado pela Netplay:", JSON.stringify(error.response.data, null, 2));
        } else {
            console.error("👉 O erro ocorreu antes de obter uma resposta da Netplay (Problema de rede/DNS).");
        }

        return res.status(500).json({ 
            success: false, 
            mensagem: "Erro ao se conectar com o servidor da Netplay: " + error.message 
        });
    }
}

module.exports = { gerarTesteGratis };
