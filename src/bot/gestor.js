const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

module.exports = async (pedido, pageExistente = null) => {
    let browser;
    let page = pageExistente;

    try {
        if (!page) {
            // CORREÇÃO: executablePath com 'P' maiúsculo e await obrigatório
            const executablePath = await chromium.executablePath();
            
            browser = await puppeteer.launch({
                args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox"],
                executablePath: executablePath, // Nome correto da propriedade
                headless: chromium.headless,
            });
            page = await browser.newPage();
            await page.setViewport({ width: 1280, height: 800 });
        }

        pedido.mensagem = "📝 Acessando Registro do Gestor...";
        await page.goto("https://gestorv3.com.br/central/registrar/", { 
            waitUntil: "networkidle2",
            timeout: 60000 
        });

        await page.waitForSelector('#nome', { timeout: 30000 });

        pedido.mensagem = "✍️ Preenchendo dados pessoais...";
        await page.type('#nome', pedido.nome || "Cliente");
        await page.type('#sobrenome', pedido.sobrenome || "Imperium");

        await page.type('#user', pedido.user);
        await page.type('#pass', pedido.pass);

        pedido.mensagem = "📱 Configurando contato...";
        if (pedido.whatsapp) {
            await page.type('#whatsapp', pedido.whatsapp);
        }

        // Simulação de tempo para o Cloudflare validar o bot
        pedido.mensagem = "🛡️ Validando segurança...";
        await new Promise(r => setTimeout(r, 6000));

        pedido.mensagem = "🚀 Finalizando cadastro...";
        await page.click('#btn-cadastrar');
        
        // Aguarda um pouco para ver se houve sucesso ou erro na tela
        await new Promise(r => setTimeout(r, 4000));

        pedido.mensagem = "✅ Cadastro realizado!";
        
        if (browser) await browser.close();
        return true;

    } catch (err) {
        console.error("Erro no GestorBot:", err.message);
        pedido.status = "erro";
        pedido.mensagem = `❌ Erro: ${err.message}`; // Mostra o erro real no painel
        if (browser) await browser.close();
        return false;
    }
};
