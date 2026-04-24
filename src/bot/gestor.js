const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

module.exports = async (pedido) => {
    let browser;
    try {
        browser = await puppeteer.launch({
            args: [...chromium.args, "--no-sandbox"],
            executablePath: await chromium.executablePath(),
            headless: true
        });

        const page = await browser.newPage();
        await page.goto("https://gestorv3.com.br/central/registrar/", { waitUntil: "networkidle2" });

        // Preenche campos conforme imagens
        await page.type('input[placeholder="Seu nome"]', pedido.nome);
        await page.type('input[placeholder="Seu sobrenome"]', pedido.sobrenome || "Cliente");
        await page.type('input[placeholder="Crie um usuário"]', pedido.user);
        await page.type('input[placeholder="Crie uma senha"]', pedido.pass);
        
        if (pedido.whatsapp) {
            await page.type('input[placeholder="(00) 00000-0000"]', pedido.whatsapp);
        }

        await page.click('button.bg-purple-600'); 
        await page.waitForNavigation({ timeout: 10000 });
        console.log("Cadastro Gestor OK");

    } catch (err) {
        console.error("Erro Gestor:", err.message);
    } finally {
        if (browser) await browser.close();
    }
};
