const axios = require('axios');

/**
 * Controla a geração de testes automáticos via painel vinculando ao qpainel da Netplay/Botbot
 */
async function gerarTesteGratis(req, res) {
    console.log("\n============================================================");
    console.log("📥 [BACKEND LOG] REQUISIÇÃO RECEBIDA EM /api/teste-gratis");
    console.log("============================================================");

    const { whatsapp, tipoTeste, nomeCliente, termoAceito } = req.body;

    // 1. Validações de segurança básicas
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

        // 3. Dispara os dados para a API da Netplay/Botbot
        const respostaNetplay = await axios.post(urlNetplay, {
            phone: whatsapp,
            name: nomeCliente || "Cliente do Painel"
        });

        console.log("📦 [BACKEND] Resposta Bruta da Netplay:", JSON.stringify(respostaNetplay.data, null, 2));

        // Inicializa as variáveis que precisamos extrair
        let username = respostaNetplay.data.username;
        let password = respostaNetplay.data.password;
        let dns = respostaNetplay.data.dns || 'http://galaxy.blcplay.com';
        let nomePacote = respostaNetplay.data.package || "Teste Automático";
        let expiresAtFormatted = respostaNetplay.data.expiresAtFormatted || "12 Horas";

        // 4. Tratamento Especial para o formato "reply" do Botbot
        // Se os dados não vierem na raiz, mas vierem dentro do texto do 'reply'
        if ((!username || !password) && respostaNetplay.data.reply) {
            console.log("🔍 [BACKEND] Detectado formato de texto 'reply'. Extraindo credenciais via Regex...");
            const textoChatbot = respostaNetplay.data.reply;

            // Expressões regulares para capturar o que está depois de "USUÁRIO IPTV:" e "SENHA IPTV:"
            const regexUser = /USUÁRIO\s+IPTV:\s*([^\n\r]+)/i;
            const regexPass = /SENHA\s+IPTV:\s*([^\n\r]+)/i;

            const matchUser = textoChatbot.match(regexUser);
            const matchPass = textoChatbot.match(regexPass);

            if (matchUser && matchUser[1]) {
                username = matchUser[1].trim();
            }
            if (matchPass && matchPass[1]) {
                password = matchPass[1].trim();
            }
        }

        // 5. Se mesmo após a varredura não encontrar Usuário ou Senha
        if (!username || !password) {
            console.warn("⚠️ [BACKEND] Não foi possível encontrar usuário e senha na resposta.");
            return res.json({ 
                success: false, 
                mensagem: "Não foi possível gerar. Este número pode já ter consumido um teste recente ou o saldo do painel acabou." 
            });
        }

        console.log(`✅ [BACKEND] Sucesso! Usuário Extraído: ${username} | Senha: ${password}`);

        // 6. Devolve as credenciais redondinhas para o front-end mapear na tela
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
        return res.status(500).json({ 
            success: false, 
            mensagem: "Erro ao se conectar com o servidor da Netplay: " + error.message 
        });
    }
}

module.exports = { gerarTesteGratis };
