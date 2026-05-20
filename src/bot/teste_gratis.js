const axios = require('axios');
// Importação alinhada com a estrutura: recua uma pasta e entra em services
const { enviarMensagemTexto } = require('../services/whatsapp_service'); 

/**
 * Controla a geração de testes automáticos conectando à Netplay e 
 * acionando a transação própria de WhatsApp através da ponte no Streamlit.
 */
async function gerarTesteGratis(req, res) {
    let whatsappLimpo = req.body.whatsapp ? req.body.whatsapp.replace(/\D/g, '') : "";
    if (whatsappLimpo && !whatsappLimpo.startsWith('55') && whatsappLimpo.length <= 11) {
        whatsappLimpo = '55' + whatsappLimpo;
    }

    const { tipoTeste, nomeCliente } = req.body;

    if (!whatsappLimpo) {
        return res.json({ success: false, mensagem: "O número de WhatsApp é obrigatório para evitar papa-testes." });
    }

    // Gerenciador de rotas da Netplay (Com / Sem Adulto)
    let urlNetplay = "https://netplay.mplll.com/api/chatbot/ANKWPy01PR/we6Wn50DK8"; // Sem Adulto
    if (tipoTeste === 'com_adulto' || tipoTeste === 'com_adulto🔥') {
        urlNetplay = "https://netplay.mplll.com/api/chatbot/ANKWPy01PR/bOxLA7yWZ7"; // Com Adulto
    }

    try {
        console.log(`📡 [Teste Grátis] Solicitando credenciais na Netplay para: ${whatsappLimpo}`);

        // Requisição para gerar o teste no painel master
        const respostaNetplay = await axios.post(urlNetplay, {
            appName: "com.whatsapp",
            messageDateTime: Math.floor(Date.now() / 1000),
            devicePhone: "554598224789", 
            deviceName: "Painel Imperium",
            senderName: nomeCliente || "Cliente Web",
            senderMessage: tipoTeste === 'com_adulto' ? "Teste com adulto" : "Teste sem adulto",
            senderPhone: whatsappLimpo, 
            userAgent: "BotBot"
        }, {
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'BotBot'
            },
            timeout: 15000
        });

        const dadosNetplay = respostaNetplay.data || {};
        const username = dadosNetplay.username || (dadosNetplay.dados && dadosNetplay.dados.username);
        const password = dadosNetplay.password || (dadosNetplay.dados && dadosNetplay.dados.password);
        const dns = dadosNetplay.dns || 'http://galaxy.blcplay.com';

        // Validação anti-fraude: se não vierem credenciais, barramos na hora
        if (!username || !password) {
            console.log(`⚠️ [Teste Grátis] Netplay bloqueou geração para: ${whatsappLimpo} (Provável Duplicado)`);
            return res.json({ success: false, mensagem: "VOCÊ JÁ REALIZOU O TESTE!" });
        }

        const prazoExpiracao = dadosNetplay.expiresAtFormatted || dadosNetplay.validade || "6 Horas";
        const agora = new Date();
        const dataCriacao = agora.toLocaleDateString('pt-BR') + ' ' + agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        // TEXTO PADRÃO FORMATADO QUE ENTRARÁ DIRETO NO WHATSAPP DO CLIENTE
        const mensagemWhats = `*TESTE GERADO COM SUCESSO!*\n\n` +
                              `👤 *Usuário:* ${username}\n` +
                              `🔑 *Senha:* ${password}\n` +
                              `📅 *Data da Criação:* ${dataCriacao}\n` +
                              `⏳ *Expiração:* ${prazoExpiracao}\n\n` +
                              `🌐 *DNS/URL:* ${dns}`;

        // Executa o disparo para o microserviço Python no Streamlit em segundo plano
        enviarMensagemTexto(whatsappLimpo, mensagemWhats);

        // Retorna a resposta imediata para a tela do site do cliente
        return res.json({
            success: true,
            mensagem: "TESTE GERADO COM SUCESSO VOCE RECEBERA SEU USUARIO E SENHA NO WHATSAAP EM BREVE!",
            dados: { username, password, dns, validade: prazoExpiracao }
        });

    } catch (error) {
        console.error("❌ Erro ao processar fluxo teste_gratis:", error.message);
        if (error.response) {
            return res.json({ success: false, mensagem: "VOCÊ JÁ REALIZOU O TESTE!" });
        }
        return res.json({ success: false, message: "Erro de comunicação com o servidor central." });
    }
}

module.exports = { gerarTesteGratis };
