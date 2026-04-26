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

        // 1. INÍCIO DO PROCESSO
        pedido.mensagem = "🌐 Abrindo painel IBO...";
        await page.goto("https://iboproapp.com/manage-playlists/login/", { waitUntil: "networkidle2" });
        
        pedido.mensagem = "🔑 Realizando login...";
        await page.waitForSelector('#mac_address');
        await page.type('#mac_address', pedido.mac);
        await page.type('#password', pedido.key);
        
        await Promise.all([
            page.keyboard.press('Enter'),
            page.waitForNavigation({ waitUntil: "networkidle2" })
        ]);

        // 2. LOOP DE LIMPEZA COM FEEDBACK NO PAINEL
        while (true) {
            pedido.mensagem = "🔄 Atualizando lista de conteúdos...";
            await page.reload({ waitUntil: "networkidle2" });
            
            // Conta listas reais pelos botões amarelos específicos
            const totalListas = await page.$$eval('button.styles_button__17ZvA', btns => btns.length);
            
            if (totalListas === 0) {
                pedido.mensagem = "✨ Sucesso! Painel 100% limpo.";
                break; 
            }

            pedido.mensagem = `🗑️ Encontradas ${totalListas} listas. Excluindo...`;

            // Localiza o botão Delete exato
            const btnDelete = await page.$('button.styles_button__17ZvA');
            if (btnDelete) {
                await btnDelete.click();

                // 3. MODAL DE PIN
                pedido.mensagem = "⌨️ Digitando PIN 123321...";
                await page.waitForSelector('input[name="pin"]', { visible: true, timeout: 8000 });
                
                const inputPin = await page.$('input[name="pin"]');
                await inputPin.click({ clickCount: 3 }); 
                await page.keyboard.press('Backspace');
                await page.keyboard.type("123321", { delay: 100 }); 

                pedido.mensagem = "🚀 Confirmando exclusão...";
                await page.keyboard.press('Enter');
                
                // Força o clique no OK se o Enter falhar
                await page.evaluate(() => {
                    const okBtn = document.querySelector('button.btn-success');
                    if (okBtn) okBtn.click();
                });

                // Pausa necessária para o servidor processar
                await new Promise(r => setTimeout(r, 7500));
            } else {
                break;
            }
        }
        
    } catch (err) {
        console.error("Erro no Cleaner:", err.message);
        pedido.mensagem = "❌ Erro na limpeza. Tente novamente.";
    } finally {
        if (browser) await browser.close();
    }
};
