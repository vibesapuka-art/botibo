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
        await page.setViewport({ width: 1280, height: 1600 });
        page.setDefaultNavigationTimeout(60000);

        atualizarStatus(pedido.mac, "acessando_site", "Abrindo portal IBO Player...");
        await page.goto('https://iboplayer.com/device/login', { waitUntil: 'networkidle2' });

        // --- NOVO MÉTODO DE ACEITE DE TERMOS ---
        try {
            const seletorAceitar = "button.btn-danger, #cookie_action_close_header, .btn-accept";
            await page.waitForSelector(seletorAceitar, { timeout: 15000 });

            // Executa um script direto no navegador para clicar e forçar o sumiço do modal
            await page.evaluate((sel) => {
                const btn = document.querySelector(sel);
                if (btn) {
                    btn.scrollIntoView();
                    btn.click();
                    // Força o fechamento removendo a classe de overlay se o clique falhar
                    setTimeout(() => {
                        const modal = document.querySelector('.modal-backdrop, #cookie-law-info-bar');
                        if (modal) modal.style.display = 'none';
                    }, 500);
                }
            }, seletorAceitar);
            
            console.log("Comando de aceite enviado.");
            await new Promise(r => setTimeout(r, 3000)); // Espera a transição da tela
        } catch (e) {
            console.log("Modal de termos não detectado.");
        }
        // ----------------------------------------

        atualizarStatus(pedido.mac, "carregando_captcha", "Localizando Captcha...");

        // Tenta encontrar a imagem do captcha por seletores variados
        const seletorImg = 'form img[src*="captcha"], .captcha-img img, #login-form img';
        
        // Espera o captcha aparecer. Se falhar aqui, o erro de Timeout é capturado.
        await page.waitForSelector(seletorImg, { timeout: 30000 });

        // Garante que o elemento está visível para o print
        await page.evaluate((sel) => {
            document.querySelector(sel).scrollIntoView({block: "center"});
        }, seletorImg);

        const captchaElement = await page.$(seletorImg);
        const captchaBase64 = await captchaElement.screenshot({ encoding: 'base64' });

        atualizarStatus(pedido.mac, "aguardando_captcha", "Digite o código:", {
            captchaBase64: `data:image/png;base64,${captchaBase64}`
        });

        // Espera a digitação
        let resolvido = false;
        let tempoInicio = Date.now();
        while (!resolvido) {
            if (Date.now() - tempoInicio > 180000) throw new Error("Tempo esgotado.");
            await new Promise(r => setTimeout(r, 2000));

            if (pedido.captchaDigitado) {
                atualizarStatus(pedido.mac, "processando", "Enviando...");
                await page.type("input[name='mac']", pedido.mac);
                
                const temKey = await page.$("input[name='key']");
                if (temKey && pedido.key) await page.type("input[name='key']", pedido.key);
                
                await page.type("input[name='captcha']", pedido.captchaDigitado);
                
                await Promise.all([
                    page.click("button[type='submit']"),
                    page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {})
                ]);
                resolvido = true;
            }
        }
        atualizarStatus(pedido.mac, "ok", "✅ Sucesso!");

    } catch (error) {
        // Exibe o erro de forma mais clara no seu painel
        atualizarStatus(pedido.mac, "erro", "Falha técnica: " + error.message);
    } finally {
        if (browser) await browser.close();
    }
}

module.exports = { executarIboCom };
