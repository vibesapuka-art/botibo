const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

module.exports = async (pedido, pageExistente = null) => {
    let browser;
    let page = pageExistente;

    try {
        // Se não recebermos uma página aberta da Engine, criamos uma nova
        if (!page) {
            browser = await puppeteer.launch({
                args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox"],
                executable_path: await chromium.executablePath(),
                headless: true
            });
            page = await browser.newPage();
            await page.setViewport({ width: 1280, height: 800 });
        }

        pedido.mensagem = "📝 Acessando Registro do Gestor...";
        await page.goto("https://gestorv3.com.br/central/registrar/", { 
            waitUntil: "networkidle2",
            timeout: 60000 
        });

        // Aguarda os campos carregarem na tela
        await page.waitForSelector('#nome');

        pedido.mensagem = "✍️ Preenchendo dados pessoais...";
        // Dados Pessoais
        await page.type('#nome', pedido.nome || "Cliente");
        await page.type('#sobrenome', pedido.sobrenome || "Imperium");

        // Credenciais de Acesso
        await page.type('#user', pedido.user);
        await page.type('#pass', pedido.pass);

        pedido.mensagem = "📱 Configurando contato...";
        // Contato e Informações
        // O código do país já vem como 55 por padrão no HTML
        if (pedido.whatsapp) {
            await page.type('#whatsapp', pedido.whatsapp);
        }

        // Simulação de tempo para o Cloudflare validar o bot
        pedido.mensagem = "🛡️ Validando segurança...";
        await new Promise(r => setTimeout(r, 5000));

        pedido.mensagem = "🚀 Finalizando cadastro...";
        // Clica no botão de criar conta
        await Promise.all([
            page.click('#btn-cadastrar'),
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {})
        ]);

        pedido.mensagem = "✅ Cadastro realizado com sucesso!";
        
        // Se abrimos um browser novo, fechamos. Se veio da engine, mantemos.
        if (browser) await browser.close();
        
        return true;

    } catch (err) {
        console.error("Erro no GestorBot:", err.message);
        pedido.status = "erro";
        pedido.mensagem = "❌ Erro no cadastro do Gestor.";
        if (browser) await browser.close();
        return false;
    }
};
