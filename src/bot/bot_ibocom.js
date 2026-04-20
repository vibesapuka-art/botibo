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
        // Viewport grande para capturar o máximo da página
        await page.setViewport({ width: 1280, height: 1800 });
        page.setDefaultNavigationTimeout(60000);

        atualizarStatus(pedido.mac, "acessando_site", "Abrindo portal IBO Player...");
        await page.goto('https://iboplayer.com/device/login', { waitUntil: 'networkidle2' });

        // 1. TENTA ACEITAR OS TERMOS
        try {
            const seletorAceitar = "button.btn-danger, #cookie_action_close_header, .btn-accept";
            await page.waitForSelector(seletorAceitar, { timeout: 10000 });
            await page.evaluate((sel) => {
                const btn = document.querySelector(sel);
                if (btn) btn.click();
            }, seletorAceitar);
            await new Promise(r => setTimeout(r, 3000));
        } catch (e) {
            console.log("Aviso de termos não encontrado.");
        }

        atualizarStatus(pedido.mac, "carregando_captcha", "Localizando Captcha...");

        // 2. TENTA LOCALIZAR O ELEMENTO DO CAPTCHA
        const seletorImg = 'form img[src*="captcha"], .captcha-img img, #login-form img';
        let captchaBase64;

        try {
            // Espera curta para não travar o processo se o site mudou
            await page.waitForSelector(seletorImg, { timeout: 10000 });
            const captchaElement = await page.$(seletorImg);
            captchaBase64 = await captchaElement.screenshot({ encoding: 'base64' });
        } catch (e) {
            // ESTRATÉGIA DE SEGURANÇA: Se não achar o captcha, tira print da tela toda
            console.log("Captcha não localizado, tirando print da tela cheia.");
            captchaBase64 = await page.screenshot({ encoding: 'base64', fullPage: false });
        }

        // Envia o print (seja do captcha ou da tela de erro) para o seu painel
        atualizarStatus(pedido.mac, "aguardando_captcha", "Confira a imagem abaixo:", {
            captchaBase64: `data:image/png;base64,${captchaBase64}`
        });

        // 3. LOOP DE ESPERA
        let resolvido = false;
        let tempoInicio = Date.now();
        while (!resolvido) {
            if (Date.now() - tempoInicio > 180000) throw new Error("Tempo esgotado.");
            await new Promise(r => setTimeout(r, 2000));

            if (pedido.captchaDigitado) {
                atualizarStatus(pedido.mac, "processando", "Enviando dados...");
                
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
        atualizarStatus(pedido.mac, "ok", "✅ Ativado!");

    } catch (error) {
        // Se der qualquer erro fatal, ele avisa no painel
        atualizarStatus(pedido.mac, "erro", "Erro Geral: " + error.message);
    } finally {
        if (browser) await browser.close();
    }
}

module.exports = { executarIboCom };
