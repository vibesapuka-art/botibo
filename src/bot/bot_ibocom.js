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
        // Definindo uma tela grande para evitar que elementos fiquem escondidos
        await page.setViewport({ width: 1280, height: 1600 });
        page.setDefaultNavigationTimeout(60000);

        atualizarStatus(pedido.mac, "acessando_site", "Abrindo portal IBO Player...");
        await page.goto('https://iboplayer.com/device/login', { waitUntil: 'networkidle2' });

        // --- LÓGICA REFORÇADA PARA OS TERMOS ---
        try {
            const seletorAceitar = "button.btn-danger, #cookie_action_close_header, .btn-accept";
            await page.waitForSelector(seletorAceitar, { timeout: 10000 });

            // Rola e clica usando JavaScript puro para ignorar bloqueios visuais
            await page.evaluate((sel) => {
                const btn = document.querySelector(sel);
                if (btn) {
                    btn.scrollIntoView({ behavior: 'instant', block: 'center' });
                    btn.click(); 
                }
            }, seletorAceitar);
            
            console.log("Botão de termos clicado.");
            await new Promise(r => setTimeout(r, 3000)); // Espera a tela de termos sumir
        } catch (e) {
            console.log("Aviso de termos não encontrado ou já aceito.");
        }
        // -------------------------------------------------------------

        atualizarStatus(pedido.mac, "carregando_captcha", "Localizando formulário de login...");

        // Garante que o formulário apareceu após aceitar os termos
        const seletorImg = 'form img[src*="captcha"], .captcha-img img';
        await page.waitForSelector(seletorImg, { timeout: 20000 });

        // Rola até o captcha para garantir que ele não saia cortado no print
        await page.evaluate((sel) => {
            const img = document.querySelector(sel);
            if (img) img.scrollIntoView({ behavior: 'instant', block: 'center' });
        }, seletorImg);

        await new Promise(r => setTimeout(r, 1000));

        const captchaElement = await page.$(seletorImg);
        const captchaBase64 = await captchaElement.screenshot({ encoding: 'base64' });

        atualizarStatus(pedido.mac, "aguardando_captcha", "Digite o código do Captcha:", {
            captchaBase64: `data:image/png;base64,${captchaBase64}`
        });

        // Loop de espera pela digitação do usuário
        let resolvido = false;
        let tempoInicio = Date.now();
        while (!resolvido) {
            if (Date.now() - tempoInicio > 180000) throw new Error("Tempo esgotado.");
            await new Promise(r => setTimeout(r, 2000));

            if (pedido.captchaDigitado) {
                atualizarStatus(pedido.mac, "processando", "Enviando dados de ativação...");
                
                await page.type("input[name='mac']", pedido.mac, { delay: 50 });
                // Verifica se o campo de Key existe antes de digitar
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
        atualizarStatus(pedido.mac, "ok", "✅ Ativado com sucesso!");

    } catch (error) {
        atualizarStatus(pedido.mac, "erro", "Falha: " + error.message);
    } finally {
        if (browser) await browser.close();
    }
}

module.exports = { executarIboCom };
