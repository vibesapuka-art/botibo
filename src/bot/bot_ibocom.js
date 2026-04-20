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
        // Define um tamanho de tela maior para facilitar a visualização dos elementos
        await page.setViewport({ width: 1280, height: 1000 });
        page.setDefaultNavigationTimeout(60000);

        atualizarStatus(pedido.mac, "acessando_site", "Abrindo portal IBO Player...");
        await page.goto('https://iboplayer.com/device/login', { waitUntil: 'networkidle2' });

        // 1. Lógica para rolar e aceitar os Termos
        try {
            const seletorBotaoAceitar = 'button#cookie_action_close_header, .btn-accept, button.btn-danger';
            await page.waitForSelector(seletorBotaoAceitar, { timeout: 8000 });
            
            // Rola até o botão de aceitar para garantir que ele esteja visível
            await page.evaluate((sel) => {
                const el = document.querySelector(sel);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, seletorBotaoAceitar);

            await new Promise(r => setTimeout(r, 1000));
            await page.click(seletorBotaoAceitar);
            console.log("Termos aceitos.");
        } catch (e) {
            console.log("Aviso de termos não apareceu.");
        }

        // 2. Rolar para baixo até o formulário de Login
        atualizarStatus(pedido.mac, "carregando_captcha", "Localizando Captcha...");
        const seletorForm = 'form';
        await page.waitForSelector(seletorForm);
        await page.evaluate(() => window.scrollBy(0, 500)); // Rola 500 pixels para baixo

        try {
            // Seletor focado na imagem do captcha dentro do form
            const seletorImg = 'form img[src*="captcha"], img.captcha-img';
            await page.waitForSelector(seletorImg, { timeout: 20000 });

            // Garante que a imagem carregou (naturalWidth > 0)
            await page.waitForFunction((sel) => {
                const img = document.querySelector(sel);
                return img && img.complete && img.naturalWidth > 0;
            }, { timeout: 10000 }, seletorImg);

            const captchaElement = await page.$(seletorImg);
            // Tira o print focado apenas no elemento do captcha
            const captchaBase64 = await captchaElement.screenshot({ encoding: 'base64' });

            atualizarStatus(pedido.mac, "aguardando_captcha", "Digite o código:", {
                captchaBase64: `data:image/png;base64,${captchaBase64}`
            });

            // 3. Espera a digitação e envia
            let resolvido = false;
            let tempoInicio = Date.now();
            while (!resolvido) {
                if (Date.now() - tempoInicio > 180000) throw new Error("Tempo esgotado.");
                await new Promise(r => setTimeout(r, 2000));

                if (pedido.captchaDigitado) {
                    atualizarStatus(pedido.mac, "processando", "Enviando...");
                    await page.type("input[name='mac']", pedido.mac, { delay: 50 });
                    // Tenta preencher a Device Key se existir no formulário
                    const temKey = await page.$("input[name='key']");
                    if (temKey && pedido.key) await page.type("input[name='key']", pedido.key, { delay: 50 });
                    
                    await page.type("input[name='captcha']", pedido.captchaDigitado, { delay: 50 });
                    
                    await Promise.all([
                        page.click("button[type='submit']"),
                        page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {})
                    ]);
                    resolvido = true;
                }
            }
            atualizarStatus(pedido.mac, "ok", "✅ Sucesso!");
        } catch (e) {
            atualizarStatus(pedido.mac, "erro", "Erro ao capturar imagem. Tente de novo.");
        }
    } catch (error) {
        atualizarStatus(pedido.mac, "erro", "Falha: " + error.message);
    } finally {
        if (browser) await browser.close();
    }
}

module.exports = { executarIboCom };
