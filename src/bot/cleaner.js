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
        pedido.mensagem = "Conectando ao painel...";
        await page.goto("https://iboproapp.com/manage-playlists/login/", { waitUntil: "networkidle2" });
        await page.waitForSelector('#mac_address');
        await page.type('#mac_address', pedido.mac);
        await page.type('#password', pedido.key);
        await Promise.all([
            page.click('button[type="submit"]'),
            page.waitForNavigation({ waitUntil: "networkidle2" })
        ]);

        // 2. LOOP DE LIMPEZA
        while (true) {
            await page.reload({ waitUntil: "networkidle2" });
            
            // Conta listas reais baseada nos botões Delete amarelos
            const totalListas = await page.$$eval('button.btn-warning', btns => btns.length);
            
            if (totalListas === 0) {
                pedido.mensagem = "✅ Tudo limpo! Aparelho liberado.";
                break; 
            }

            pedido.mensagem = `Encontradas ${totalListas} listas. Excluindo...`;

            // Clica no botão Delete
            await page.evaluate(() => {
                const btn = document.querySelector('button.btn-warning');
                if (btn) btn.click();
            });

            // 3. PREENCHIMENTO DO PIN REFORÇADO
            try {
                // Aguarda o campo de PIN aparecer
                await page.waitForSelector('input[name="pin"]', { visible: true, timeout: 8000 });
                
                // Limpa o campo e digita o PIN com atraso humano
                const inputPin = await page.$('input[name="pin"]');
                await inputPin.click({ clickCount: 3 }); // Garante que limpou
                await page.keyboard.press('Backspace');
                await page.keyboard.type("123321", { delay: 200 }); 

                // EM VEZ DE SÓ CLICAR, APERTA ENTER (Mais seguro contra bloqueios de clique)
                await page.keyboard.press('Enter');

                // Tenta também o clique no botão Ok verde por garantia
                await page.evaluate(() => {
                    const okBtn = document.querySelector('button.btn-success');
                    if (okBtn) okBtn.click();
                });

                // Pausa de 6 segundos: dá tempo do servidor processar e sumir com a lista
                await new Promise(r => setTimeout(r, 6000));
                
            } catch (pinErr) {
                console.log("Erro ao preencher PIN ou modal não apareceu.");
                break;
            }
        }
        
    } catch (err) {
        console.error("Erro no Cleaner:", err.message);
        pedido.mensagem = "❌ Erro: " + err.message;
    } finally {
        if (browser) await browser.close();
    }
};
