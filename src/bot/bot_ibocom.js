const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

async function executarIboCom(pedido, atualizarStatus) {
    let browser;
    try {
        browser = await puppeteer.launch({
            args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox"],
            executablePath: await chromium.executablePath(),
            headless: true
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 900 });

        atualizarStatus(pedido.mac, "acessando_site", "Abrindo portal IBO Player...");
        await page.goto('https://iboplayer.com/device/login', { 
            waitUntil: 'networkidle2',
            timeout: 60000 
        });

        // --- NOVIDADE: ACEITAR OS TERMOS AUTOMATICAMENTE ---
        try {
            const botaoAceitar = "button.btn-danger"; // Seletor do botão 'Accept legal terms'
            atualizarStatus(pedido.mac, "aceitando_termos", "Aceitando termos de uso...");
            
            // Espera o botão vermelho de termos aparecer e clica nele
            await page.waitForSelector(botaoAceitar, { timeout: 10000 });
            await page.click(botaoAceitar);
            
            // Espera um segundo para a tela sumir
            await new Promise(r => setTimeout(r, 1500));
        } catch (e) {
            console.log("Aviso de termos não apareceu ou já foi aceito.");
        }
        // --------------------------------------------------

        atualizarStatus(pedido.mac, "carregando_captcha", "Localizando código de segurança...");
        
        try {
            // Procura a imagem do captcha após fechar os termos
            const captchaImgSelector = 'label[for="captcha"] + img';
            await page.waitForSelector(captchaImgSelector, { timeout: 20000 });
            
            const captchaElement = await page.$(captchaImgSelector);
            const captchaBase64 = await captchaElement.screenshot({ encoding: 'base64' });

            atualizarStatus(pedido.mac, "aguardando_captcha", "Digite o código da imagem abaixo:", {
                captchaBase64: `data:image/png;base64,${captchaBase64}`
            });

            let resolvido = false;
            let inicio = Date.now();
            while (!resolvido) {
                if (Date.now() - inicio > 120000) throw new Error("Tempo esgotado.");
                await new Promise(r => setTimeout(r, 2000));

                if (pedido.captchaDigitado) {
                    atualizarStatus(pedido.mac, "processando", "Finalizando ativação...");
                    
                    await page.type("input[name='mac']", pedido.mac);
                    if (pedido.key) await page.type("input[name='key']", pedido.key);
                    await page.type("input[name='captcha']", pedido.captchaDigitado);
                    
                    await page.click("button[type='submit']");
                    resolvido = true;
                }
            }

            await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 });
            atualizarStatus(pedido.mac, "ok", "✅ Ativado com sucesso!");

        } catch (e) {
            atualizarStatus(pedido.mac, "erro", "Erro ao carregar Captcha. Tente novamente.");
        }
    } catch (error) {
        atualizarStatus(pedido.mac, "erro", "Erro de conexão: " + error.message);
    } finally {
        if (browser) await browser.close();
    }
}

module.exports = { executarIboCom };
