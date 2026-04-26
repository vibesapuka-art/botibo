const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

module.exports = async (pedido) => {
    let browser;
    try {
        browser = await puppeteer.launch({
            args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox"],
            executablePath: await chromium.executablePath(),
            headless: true 
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });

        // 1. LOGIN
        pedido.mensagem = "🔑 Acessando painel...";
        await page.goto("https://iboproapp.com/manage-playlists/login/", { waitUntil: "domcontentloaded" });
        await page.type('#mac_address', pedido.mac);
        await page.type('#password', pedido.key);
        await page.keyboard.press('Enter');
        await page.waitForNavigation({ waitUntil: "domcontentloaded" });

        // 2. LOOP DE LIMPEZA
        while (true) {
            // Seletor exato do botão Delete que você enviou
            const btnDelete = await page.$('button.styles_button__17ZvA');

            if (!btnDelete) {
                pedido.mensagem = "✅ Painel limpo!";
                break; 
            }

            // Clica no Delete
            await btnDelete.click();

            // 3. MODAL DE PIN
            // Seletor exato do input pin que você enviou
            await page.waitForSelector('input[name="pin"]', { visible: true, timeout: 10000 });
            await page.type('input[name="pin"]', "123321"); 

            // Seletor exato do botão OK que você enviou
            await page.click('button.btn-success[type="submit"]');

            // Espera o site processar e recarrega
            await new Promise(r => setTimeout(r, 6000));
            await page.reload({ waitUntil: "domcontentloaded" });
        }
        
    } catch (err) {
        pedido.status = "erro";
        pedido.mensagem = "❌ Erro na limpeza";
    } finally {
        if (browser) await browser.close();
    }
};
