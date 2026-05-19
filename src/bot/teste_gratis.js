const axios = require('axios');

/**
 * Controla a geração de testes automáticos via painel vinculando ao qpainel da Netplay
 */
async function gerarTesteGratis(req, res) {
    // Coleta as informações vindas do Passo 4 do formulário do Painel
    const { whatsapp, tipoTeste, nomeCliente } = req.body;

    // 1. Validação do número de WhatsApp
    if (!whatsapp) {
        return res.json({ success: false, mensagem: "O número de WhatsApp é obrigatório para gerar o teste." });
    }

    // 2. Define os endpoints da Netplay (Com ou Sem Adulto)
    let urlNetplay = "https://netplay.mplll.com/api/chatbot/ANKWPy01PR/we6Wn50DK8"; // Sem Adulto
    if (tipoTeste === 'com_adulto') {
        urlNetplay = "https://netplay.mplll.com/api/chatbot/ANKWPy01PR/bOxLA7yWZ7"; // Com Adulto
    }

    try {
        console.log(`📡 [Teste Grátis] Solicitando na Netplay para: ${whatsapp} | Nome: ${nomeCliente} | Tipo: ${tipoTeste}`);

        // 3. Dispara os dados para a API da Netplay registrar no painel deles com Nome e Telefone
        const respostaNetplay = await axios.post(urlNetplay, {
            phone: whatsapp,
            name: nomeCliente || "Cliente do Painel"
        });

        // Captura o retorno do servidor da Netplay
        const { username, password, dns, package: nomePacote, expiresAtFormatted } = respostaNetplay.data;

        // 4. Se a Netplay recusar ou não devolver credenciais (ex: número duplicado ou sem créditos)
        if (!username || !password) {
            return res.json({ 
                success: false, 
                mensagem: "Não foi possível gerar o teste. Este número pode já ter consumido um teste recente ou o painel atingiu o limite." 
            });
        }

        // 5. Devolve as credenciais com sucesso para o front-end (index.html) exibir na tela
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
