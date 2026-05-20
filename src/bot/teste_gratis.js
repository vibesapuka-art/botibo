const axios = require('axios');

/**
 * Controla a geração de testes automáticos via painel vinculando ao qpainel da Netplay
 */
async function gerarTesteGratis(req, res) {
    // Tratamento preventivo do número para garantir que tenha apenas dígitos e o DDI 55
    let whatsappLimpo = req.body.whatsapp ? req.body.whatsapp.replace(/\D/g, '') : "";
    if (whatsappLimpo && !whatsappLimpo.startsWith('55') && whatsappLimpo.length <= 11) {
        whatsappLimpo = '55' + whatsappLimpo;
    }

    const { tipoTeste, nomeCliente, termoAceito } = req.body;

    // 1. Validação de segurança básica
    if (!whatsappLimpo) {
        return res.json({ success: false, mensagem: "O número de WhatsApp é obrigatório para evitar papa-testes." });
    }

    // 2. Define os endpoints do Botbot da Netplay (Com ou Sem Adulto)
    let urlNetplay = "https://netplay.mplll.com/api/chatbot/ANKWPy01PR/we6Wn50DK8"; // Sem Adulto
    if (tipoTeste === 'com_adulto' || tipoTeste === 'com_adulto🔥') {
        urlNetplay = "https://netplay.mplll.com/api/chatbot/ANKWPy01PR/bOxLA7yWZ7"; // Com Adulto
    }

    try {
        console.log(`📡 [Teste Grátis] Solicitando na Netplay para: ${whatsappLimpo} | Tipo: ${tipoTeste}`);

        // 3. Dispara os dados simulando o payload nativo que o BotBot espera para registrar o contato
        const respostaNetplay = await axios.post(urlNetplay, {
            appName: "com.whatsapp",
            messageDateTime: Math.floor(Date.now() / 1000),
            devicePhone: "554598224789", // Mantém a consistência com o número do seu bot se necessário
            deviceName: "Painel Imperium",
            senderName: nomeCliente || "Cliente Web",
            senderMessage: tipoTeste === 'com_adulto' ? "Teste com adulto" : "Teste sem adulto",
            senderPhone: whatsappLimpo, // WhatsApp do cliente com 55 na frente
            userAgent: "BotBot"
        }, {
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'BotBot'
            },
            timeout: 15000
        });

        // Captura e normalização dos dados retornados
        const dadosNetplay = respostaNetplay.data || {};
        const username = dadosNetplay.username || (dadosNetplay.dados && dadosNetplay.dados.username);
        const password = dadosNetplay.password || (dadosNetplay.dados && dadosNetplay.dados.password);
        const dns = dadosNetplay.dns || (dadosNetplay.dados && dadosNetplay.dados.dns) || 'http://galaxy.blcplay.com';
        const nomePacote = dadosNetplay.package || dadosNetplay.pacote || "Teste Grátis";
        const expiresAtFormatted = dadosNetplay.expiresAtFormatted || dadosNetplay.validade || "12 Horas";

        // 4. Se a Netplay recusar (número duplicado ou limite estourado)
        if (!username || !password) {
            console.log(`⚠️ [Teste Grátis] Netplay não retornou credenciais válidas para: ${whatsappLimpo}`);
            return res.json({ 
                success: false, 
                mensagem: "Não foi possível gerar as credenciais. Este número pode já ter consumido um teste recente ou o painel atingiu o limite." 
            });
        }

        // 5. Devolve as credenciais com sucesso para o front-end montar o tutorial do cliente
        console.log(`✅ [Teste Grátis] Sucesso para ${whatsappLimpo}! Usuário gerado: ${username}`);
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
        return res.json({ 
            success: false, 
            mensagem: "Erro ao se conectar com o servidor da Netplay: " + error.message 
        });
    }
}

module.exports = { gerarTesteGratis };
