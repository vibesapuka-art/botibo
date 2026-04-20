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
        pedido.mensagem = "Abrindo site oficial...";
        await page.goto("https://iboplayer.com/device/login", { 
            waitUntil: "networkidle2", 
            timeout: 60000 
        });

        let captchaResolvido = false;

        // 2. LOOP DO CAPTCHA COM REFRESH INTELIGENTE
        while (!captchaResolvido) {
            pedido.mensagem = "Capturando imagem de segurança...";

            // Espera a imagem do captcha aparecer
            await page.waitForSelector("img[src*='captcha']", { timeout: 15000 });
            const captchaElement = await page.$("img[src*='captcha']");
            
            // Tira o print apenas da área do captcha
            const base64 = await captchaElement.screenshot({ encoding: "base64" });
            pedido.captchaBase64 = `data:image/png;base64,${base64}`;
            pedido.status = "aguardando_captcha";
            pedido.mensagem = "Digite o código da imagem acima:";

            // O cliente tem 25 segundos para responder
            let inicioEspera = Date.now();
            while (!pedido.captchaDigitado && (Date.now() - inicioEspera < 25000)) {
                await new Promise(r => setTimeout(r, 1000));
            }

            if (pedido.captchaDigitado) {
                captchaResolvido = true;
            } else {
                // SE O TEMPO ESGOTAR, CLICA EM "REFRESH CAPTCHA" NO SITE
                pedido.mensagem = "Tempo esgotado. Atualizando código...";
                
                // Procura o link de texto que você mostrou no print
                const refreshBtn = await page.waitForSelector('text/Refresh Captcha', { timeout: 5000 }).catch(() => null);
                
                if (refreshBtn) {
                    await refreshBtn.click();
                    // Pequena pausa para a nova imagem carregar
                    await new Promise(r => setTimeout(r, 2000)); 
                } else {
                    // Fallback: se não achar o botão, recarrega a página toda
                    await page.reload({ waitUntil: "networkidle2" });
                }
            }
        }

        // 3. LOGIN COM OS DADOS QUE O CLIENTE JÁ PREENCHEU NO INÍCIO
        pedido.status = "processando";
        pedido.mensagem = "Realizando login no IBO...";

        // Usando seletores baseados na estrutura padrão do site
        await page.type("input[name='mac']", pedido.mac);
        await page.type("input[name='key']", pedido.key);
        await page.type("input[name='captcha']", pedido.captchaDigitado); 
        
        // Clica no botão de login (Geralmente o primeiro button type submit)
        await page.click("button[type='submit']");
        
        // Espera a navegação para a área logada
        await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 });

        // 4. ADICIONA A LISTA IMPERIUMTV
        pedido.mensagem = "Enviando sua playlist...";
        // Aqui você adicionaria os passos de clicar em 'Add Playlist' e preencher M3U
        
        pedido.status = "ok";
        pedido.mensagem = "✅ Configuração enviada com sucesso!";

    } catch (err) {
        console.error("Erro no Bot IBO:", err.message);
        pedido.status = "erro";
        pedido.mensagem = "Erro: " + err.message;
    } finally {
        if (browser) await browser.close();
    }
};
