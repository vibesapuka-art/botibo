const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

module.exports = async (pedido) => {
    // FORÇA O STATUS A MUDAR NA HORA
    pedido.status = "processando"; 
    pedido.mensagem = "🚀 Bot de limpeza iniciado...";

    let browser;
    try {
        browser = await puppeteer.launch({
            args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox"],
            executablePath: await chromium.executablePath(),
            headless: true 
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });

        pedido.mensagem = "🔑 Fazendo login no IBO...";
        await page.goto("https://iboproapp.com/manage-playlists/login/", { waitUntil: "networkidle2" });
        
        await page.waitForSelector('#mac_address');
        await page.type('#mac_address', pedido.mac);
        await page.type('#password', pedido.key);
        await page.keyboard.press('Enter');
        await page.waitForNavigation({ waitUntil: "networkidle2" });

        while (true) {
            pedido.mensagem = "🔄 Escaneando playlists...";
            await page.reload({ waitUntil: "networkidle2" });
            
            const btnDelete = await page.$('button.styles_button__17ZvA');
            
            if (!btnDelete) {
                pedido.mensagem = "✅ Limpeza concluída!";
                pedido.status = "ok";
                break; 
            }

            pedido.mensagem = "🗑️ Deletando lista encontrada...";
            await btnDelete.click();

            await page.waitForSelector('input[name="pin"]', { visible: true, timeout: 8000 });
            await page.type('input[name="pin"]', "123321"); 
            await page.keyboard.press('Enter');

            // Tempo para o servidor do IBO processar
            await new Promise(r => setTimeout(r, 7000));
        }
        
    } catch (err) {
        pedido.status = "erro";
        pedido.mensagem = "❌ Falha: " + err.message;
    } finally {
        if (browser) await browser.close();
    }
};
