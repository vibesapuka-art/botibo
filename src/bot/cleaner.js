const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

module.exports = async (pedido) => {
    // Força a mudança imediata no painel
    pedido.status = "processando";
    pedido.mensagem = "🚀 Iniciando motor de limpeza...";

    let browser;
    try {
        browser = await puppeteer.launch({
            args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox"],
            executablePath: await chromium.executablePath(),
            headless: true 
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });

        pedido.mensagem = "🌐 Conectando ao painel IBO...";
        await page.goto("https://iboproapp.com/manage-playlists/login/", { waitUntil: "networkidle2" });
        
        await page.waitForSelector('#mac_address');
        await page.type('#mac_address', pedido.mac);
        await page.type('#password', pedido.key);
        
        pedido.mensagem = "🔑 Autenticando...";
        await Promise.all([
            page.keyboard.press('Enter'),
            page.waitForNavigation({ waitUntil: "networkidle2" })
        ]);

        while (true) {
            pedido.mensagem = "🔄 Analisando playlists...";
            await page.reload({ waitUntil: "networkidle2" });
            
            // Usa o seletor exato que você extraiu do código-fonte
            const btnDelete = await page.$('button.styles_button__17ZvA');
            
            if (!btnDelete) {
                pedido.mensagem = "✨ Sucesso! Painel 100% limpo.";
                pedido.status = "ok";
                break; 
            }

            // Conta quantas faltam para mostrar no painel
            const restam = await page.$$eval('button.styles_button__17ZvA', btns => btns.length);
            pedido.mensagem = `🗑️ Restam ${restam} listas. Excluindo...`;

            await btnDelete.click();

            // Modal de PIN com seletor exato
            pedido.mensagem = "⌨️ Aplicando PIN 123321...";
            await page.waitForSelector('input[name="pin"]', { visible: true, timeout: 8000 });
            
            const inputPin = await page.$('input[name="pin"]');
            await inputPin.click({ clickCount: 3 }); 
            await page.keyboard.press('Backspace');
            await page.keyboard.type("123321", { delay: 100 }); 

            // Confirmação dupla: Enter + Clique no OK
            await page.keyboard.press('Enter');
            await page.evaluate(() => {
                const okBtn = document.querySelector('button.btn-success');
                if (okBtn) okBtn.click();
            });

            // Tempo para o servidor processar a exclusão
            await new Promise(r => setTimeout(r, 7500));
        }
        
    } catch (err) {
        console.error("Erro no Cleaner:", err.message);
        pedido.status = "erro";
        pedido.mensagem = "❌ Erro: " + err.message;
    } finally {
        if (browser) await browser.close();
    }
};
