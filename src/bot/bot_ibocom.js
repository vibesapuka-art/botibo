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
        
        atualizarStatus(pedido.mac, "acessando_site", "Conectando ao portal IBO...");
        await page.goto('https://iboplayer.com/device/login', { waitUntil: 'networkidle2', timeout: 60000 });

        // --- TRATAMENTO DOS TERMOS ---
        try {
            const seletorBotao = 'button.bg-main, button.btn-danger';
            await page.waitForSelector(seletorBotao, { timeout: 10000 });
            await page.click(seletorBotao);
            await new Promise(r => setTimeout(r, 3000));
        } catch (e) {
            // Força a remoção manual se o botão não funcionar
            await page.evaluate(() => {
                const modals = document.querySelectorAll('.modal, .modal-backdrop, #cookie-law-info-bar');
                modals.forEach(m => m.remove());
                document.body.classList.remove('modal-open');
            });
        }

        // --- VERIFICAÇÃO E REFRESH DE SEGURANÇA ---
        const seletorMac = "input[name='mac']";
        let encontrado = await page.$(seletorMac);

        if (!encontrado) {
            atualizarStatus(pedido.mac, "recarregando", "Campo não detectado. Recarregando página...");
            await page.reload({ waitUntil: 'networkidle2' });
            await new Promise(r => setTimeout(r, 3000));
        }

        // --- CAPTURA DO CAPTCHA ---
        const seletorForm = '#login-form, form';
        await page.waitForSelector(seletorForm, { visible: true, timeout: 20000 });
        const formElement = await page.$(seletorForm);
        
        await formElement.scrollIntoView();
        const captchaBase64 = await formElement.screenshot({ encoding: 'base64', type: 'jpeg', quality: 80 });

        atualizarStatus(pedido.mac, "aguardando_captcha", "Resolva o código abaixo:", {
            captchaBase64: `data:image/jpeg;base64,${captchaBase64}`
        });

        // --- ESPERA RESPOSTA ---
        let resolvido = false;
        let tempoInicio = Date.now();
        while (!resolvido) {
            if (Date.now() - tempoInicio > 180000) throw new Error("Tempo esgotado.");
            await new Promise(r => setTimeout(r, 2000));

            if (pedido.captchaDigitado) {
                atualizarStatus(pedido.mac, "processando", "Autenticando...");

                // Tenta focar no campo MAC antes de digitar
                await page.waitForSelector(seletorMac, { visible: true, timeout: 15000 });
                await page.focus(seletorMac);
                await page.click(seletorMac, { clickCount: 3 }); // Seleciona tudo para limpar
                await page.keyboard.press('Backspace');
                
                await page.type(seletorMac, pedido.mac, { delay: 100 });
                
                const inputKey = await page.$("input[name='key']");
                if (inputKey && pedido.key) {
                    await page.type("input[name='key']", pedido.key, { delay: 100 });
                }
                
                await page.type("input[name='captcha']", pedido.captchaDigitado, { delay: 100 });
                
                await Promise.all([
                    page.click("button[type='submit']"),
                    page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {})
                ]);
                
                atualizarStatus(pedido.mac, "ok", "✅ Logado com sucesso!");
                resolvido = true;
            }
        }

    } catch (error) {
        atualizarStatus(pedido.mac, "erro", "Falha: " + error.message);
    } finally {
        if (browser) await browser.close();
    }
}

module.exports = { executarIboCom };
