const axios = require('axios');

/**
 * Controla a geração de testes automáticos integrados à API da Netplay/Botbot
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

    console.log(`🛰️ [BACKEND] Endpoint Netplay Ativo: ${urlNetplay}`);
    
    // Configuração exata do Payload que o Botbot espera receber via POST
    const payloadNetplay = {
        phone: whatsapp,
        name: nomeCliente || "Cliente do Painel"
    };

    try {
        console.log("📤 [BACKEND] Disparando requisição para o Botbot da Netplay...");
        const respostaNetplay = await axios.post(urlNetplay, payloadNetplay);

        console.log("✨ [BACKEND] Status HTTP da Netplay:", respostaNetplay.status);
        console.log("📦 [BACKEND] Dados Brutos Retornados:", JSON.stringify(respostaNetplay.data, null, 2));

        if (!respostaNetplay.data) {
            return res.json({
                success: false,
                mensagem: "O servidor da Netplay retornou uma resposta vazia."
            });
        }

        // Mapeamento extraído com sucesso baseado nas tags reais do seu painel do Botbot:
        // {{username}}, {{password}}, {{dns}}, {{package}}, {{expiresAtFormatted}}
        const { username, password, dns, package: nomePacote, expiresAtFormatted } = respostaNetplay.data;

        // Validação secundária: se as propriedades vierem na raiz ou dentro de um objeto alternativo
        let finalUsername = username;
        let finalPassword = password;
        let finalDns = dns || 'http://galaxy.blcplay.com';
        let finalValidade = expiresAtFormatted;

        // Se por acaso vier encapsulado no formato padrão de string de resposta do webhook do Botbot
        if (!finalUsername && respostaNetplay.data.reply) {
            console.log("[BACKEND] Tentando capturar credenciais de texto alternativo ou propriedades aninhadas...");
        }

        // Se mesmo assim não capturar usuário e senha, aborta para não dar crash
        if (!finalUsername || !finalPassword) {
            console.warn("⚠️ [BACKEND] Credenciais não encontradas na estrutura da resposta da Netplay.");
            return res.json({ 
                success: false, 
                mensagem: "Não foi possível resgatar o usuário e senha da Netplay. Verifique se este número já gerou teste nas últimas 24 horas." 
            });
        }

        console.log(`✅ [BACKEND] Credenciais extraídas! Usuário: ${finalUsername} | Senha: ${finalPassword}`);
        
        return res.json({
            success: true,
            mensagem: "Teste gerado com sucesso!",
            dados: {
                username: finalUsername,
                password: finalPassword,
                dns: finalDns,
                pacote: nomePacote || "Teste Importado",
                validade: finalValidade || "12 Horas"
            }
        });

    } catch (error) {
        console.error("❌ [BACKEND] Erro crítico na requisição da Netplay:", error.message);

        if (error.response) {
            console.error("👉 Detalhes do erro da Netplay:", JSON.stringify(error.response.data, null, 2));
            return res.json({ 
                success: false, 
                mensagem: "A Netplay recusou a criação: " + (error.response.data.message || error.message) 
            });
        }

        return res.status(500).json({ 
            success: false, 
            mensagem: "Erro de conexão com o servidor externo da Netplay: " + error.message 
        });
    }
}

module.exports = { gerarTesteGratis };
