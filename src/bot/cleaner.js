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
        
        // LOGIN NO IBPRO
        await page.goto("https://iboproapp.com/manage-playlists/login/", { waitUntil: "networkidle2" });
        await page.type('input[name="mac_address"]', pedido.mac);
        await page.type('input[name="device_key"]', pedido.key);
        await page.click('button[type="submit"]');
        await page.waitForNavigation({ waitUntil: "networkidle2" });

        // LOOP DE DELETAR
        while (true) {
            // Procura botões de Delete
            const deleteBtn = await page.$('.btn-danger, button[onclick*="delete"]');
            if (!deleteBtn) break;

            pedido.mensagem = "Excluindo lista antiga...";
            await deleteBtn.click();
            
            // Aguarda o modal do PIN aparecer
            await new Promise(r => setTimeout(r, 2000));
            
            // Digita o PIN no campo que aparecer
            const pinInput = await page.$('input[name="pin"], #pin');
            if (pinInput) {
                await page.type('input[name="pin"], #pin', "123321"); // Substitua pelo seu PIN
                await page.keyboard.press('Enter');
            }

            // Espera 4 segundos conforme solicitado
            await new Promise(r => setTimeout(r, 4000));
            await page.reload({ waitUntil: "networkidle2" });
        }
        
        pedido.mensagem = "✅ Dispositivo limpo!";
    } catch (err) {
        pedido.mensagem = "Erro: Dados de login incorretos.";
        console.error(err);
    } finally {
        if (browser) await browser.close();
    }
};
