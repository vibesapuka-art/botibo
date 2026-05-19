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

        console.log("✨ [BACKEND] Status HTTP da Netplay:", respostaNetplay.status);
        console.log("📦 [BACKEND] Resposta Bruta recebida da Netplay:", JSON.stringify(respostaNetplay.data, null, 2));

        // Verificação de segurança para evitar o erro de "undefined" caso a estrutura venha vazia ou diferente
        if (!respostaNetplay.data) {
            console.error("❌ [BACKEND] A resposta da Netplay veio completamente vazia (null/undefined).");
            return res.json({
                success: false,
                mensagem: "O servidor da Netplay respondeu com dados inválidos ou vazios."
            });
        }

        const { username, password, dns, package: nomePacote, expiresAtFormatted } = respostaNetplay.data;

        // 4. Verificação de integridade das credenciais entregues
        if (!username || !password) {
            console.warn("⚠️ [BACKEND] Netplay respondeu, mas não gerou usuário/senha válidos. Pode ser número duplicado, falta de créditos ou formato inesperado.");
            
            // Se a Netplay enviou alguma mensagem de erro no corpo, nós capturamos e mandamos pro cliente
            const mensagemErroInterno = respostaNetplay.data.mensagem || respostaNetplay.data.message || "Verifique se o número já possui teste recente ou o saldo do painel.";
            
            return res.json({ 
                success: false, 
                mensagem: "Não foi possível gerar o teste: " + mensagemErroInterno
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
        console.error("❌ [BACKEND] Erro crítico na requisição para a Netplay:", error.message);

        if (error.response) {
            console.error("👉 Resposta de Erro da Netplay:", JSON.stringify(error.response.data, null, 2));
            const msgErro = error.response.data.mensagem || error.response.data.message || error.message;
            return res.json({ success: false, mensagem: "A Netplay recusou o pedido: " + msgErro });
        }

        return res.status(500).json({ 
            success: false, 
            mensagem: "Erro ao se conectar com o servidor da Netplay: " + error.message 
        });
    }
}

module.exports = { gerarTesteGratis };
