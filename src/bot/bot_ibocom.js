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
        
        // 1. ACESSA O SITE OFICIAL
        pedido.mensagem = "Abrindo site IBO Player...";
        await page.goto("https://iboplayer.com/device/login", { 
            waitUntil: "networkidle2", 
            timeout: 60000 
        });

        let captchaResolvido = false;

        // 2. LOOP DO CAPTCHA (Fica renovando se o cliente demorar)
        while (!captchaResolvido) {
            pedido.mensagem = "Capturando código de segurança...";

            // Espera a imagem do captcha carregar
            await page.waitForSelector("img[src*='captcha']", { timeout: 15000 });
            const captchaElement = await page.$("img[src*='captcha']");
            
            // Tira o print e envia para o objeto do pedido
            const base64 = await captchaElement.screenshot({ encoding: "base64" });
            pedido.captchaBase64 = `data:image/png;base64,${base64}`;
            pedido.status = "aguardando_captcha";
            pedido.mensagem = "Por favor, digite o código da imagem no painel.";
            pedido.captchaDigitado = null; // Garante que está limpo para nova tentativa

            // Espera até 25 segundos pela resposta do cliente através do index.js
            let inicioEspera = Date.now();
            while (!pedido.captchaDigitado && (Date.now() - inicioEspera < 25000)) {
                await new Promise(r => setTimeout(r, 1000));
            }

            if (pedido.captchaDigitado) {
                captchaResolvido = true;
            } else {
                // Se o tempo esgotar, clica em "Refresh Captcha" para gerar um novo print
                pedido.mensagem = "Tempo esgotado. Renovando captcha...";
                const refreshBtn = await page.waitForSelector('text/Refresh Captcha', { timeout: 5000 }).catch(() => null);
                if (refreshBtn) {
                    await refreshBtn.click();
                    await new Promise(r => setTimeout(r, 2000)); 
                } else {
                    await page.reload({ waitUntil: "networkidle2" });
                }
            }
        }

        // 3. LOGIN COM O CAPTCHA QUE O CLIENTE ENVIOU
        pedido.status = "processando";
        pedido.mensagem = "Realizando login...";

        await page.type("input[name='mac']", pedido.mac);
        await page.type("input[name='key']", pedido.key);
        await page.type("input[name='captcha']", pedido.captchaDigitado); 
        
        await page.click("button[type='submit']");
        
        // Espera a navegação (confirmação de login)
        await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 });

        // 4. ADICIONA A LISTA IMPERIUMTV (Ajuste os seletores se necessário)
        pedido.mensagem = "Enviando playlist ImperiumTv...";
        await page.goto("https://iboplayer.com/device/playlists/add", { waitUntil: "networkidle2" });
        
        await page.type("#playlist_name", "ImperiumTv");
        await page.type("#username", pedido.user);
        await page.type("#password", pedido.pass);
        await page.click("#save_button");

        pedido.status = "ok";
        pedido.mensagem = "✅ IBO PLAYER ativado com sucesso!";

    } catch (err) {
        console.error("Erro no Bot IBO:", err.message);
        pedido.status = "erro";
        pedido.mensagem = "Erro: " + err.message;
    } finally {
        if (browser) await browser.close();
    }
};
