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
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

        // 1. LOGIN
        pedido.mensagem = "🔑 Acessando painel IBO...";
        await page.goto("https://iboproapp.com/manage-playlists/login/", { waitUntil: "domcontentloaded", timeout: 60000 });
        
        await page.waitForSelector('#mac_address', { timeout: 30000 });
        await page.type('#mac_address', pedido.mac, { delay: 50 });
        await page.type('#password', pedido.key, { delay: 50 });
        await page.keyboard.press('Enter');

        await page.waitForSelector('button.btn-secondary', { timeout: 45000 });

        // 2. LOOP DE LIMPEZA COM SELETORES EXATOS
        while (true) {
            // Localiza o botão Delete pela classe exata que você mandou
            const btnDelete = await page.$('button.styles_button__17ZvA');

            if (!btnDelete) {
                pedido.mensagem = "✅ Painel totalmente limpo!";
                break; 
            }

            pedido.mensagem = "🗑️ Excluindo lista encontrada...";

            // Clica no Delete
            await btnDelete.click();

            // 3. MODAL DE CONFIRMAÇÃO (PIN e OK)
            try {
                // Aguarda o input específico de password name="pin"
                await page.waitForSelector('input[name="pin"]', { visible: true, timeout: 10000 });
                
                // Limpa e digita o PIN 123321
                await page.click('input[name="pin"]', { clickCount: 3 });
                await page.keyboard.type("123321", { delay: 100 }); 

                // Clica no botão OK (btn-success tipo submit)
                await page.click('button.btn-success[type="submit"]');

                // Espera 7 segundos para o servidor processar a exclusão
                await new Promise(r => setTimeout(r, 7000));
                
                // Recarrega a página para atualizar a tabela e evitar "botões fantasmas"
                await page.reload({ waitUntil: "domcontentloaded" });
                await page.waitForSelector('button.btn-secondary', { timeout: 20000 });
                
            } catch (pinErr) {
                console.log("Erro ao processar modal de exclusão.");
                await page.screenshot({ path: 'public/erro_cleaner_detalhado.png' });
                break;
            }
        }
        
    } catch (err) {
        console.error("❌ Erro no Cleaner:", err.message);
        pedido.mensagem = "❌ Falha na limpeza. Verifique o log.";
        if (browser) {
            const pages = await browser.pages();
            if (pages[0]) await pages[0].screenshot({ path: 'public/erro_cleaner_geral.png' });
        }
    } finally {
        if (browser) await browser.close();
    }
};
