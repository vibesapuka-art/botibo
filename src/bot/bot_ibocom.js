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
        // Viewport estendido para garantir que o formulário apareça
        await page.setViewport({ width: 1280, height: 1200 });
        page.setDefaultNavigationTimeout(60000);

        atualizarStatus(pedido.mac, "acessando_site", "Abrindo portal IBO Player...");
        await page.goto('https://iboplayer.com/device/login', { waitUntil: 'networkidle2' });

        // 1. Aceitar termos (com scroll forçado)
        try {
            const btnAceitar = "button.btn-danger, #cookie_action_close_header";
            await page.waitForSelector(btnAceitar, { timeout: 5000 });
            await page.evaluate((sel) => {
                const el = document.querySelector(sel);
                if (el) el.click();
            }, btnAceitar);
            await new Promise(r => setTimeout(r, 2000));
        } catch (e) {
            console.log("Botão de aceitar não encontrado ou já clicado.");
        }

        // 2. Posicionamento para o Print Fixo
        atualizarStatus(pedido.mac, "carregando_captcha", "Preparando captura de tela...");
        
        // Rola a página para uma posição onde o formulário geralmente reside
        await page.evaluate(() => {
            window.scrollTo(0, 400); 
        });
        await new Promise(r => setTimeout(r, 1500));

        // Tira um print de uma região fixa (clip) onde o captcha costuma aparecer
        const captchaBase64 = await page.screenshot({
            encoding: 'base64',
            clip: { x: 400, y: 450, width: 480, height: 350 } // Área central do formulário
        });

        atualizarStatus(pedido.mac, "aguardando_captcha", "Veja o código no print abaixo:", {
            captchaBase64: `data:image/png;base64,${captchaBase64}`
        });

        // 3. Loop de processamento do envio
        let resolvido = false;
        let tempoInicio = Date.now();
        while (!resolvido) {
            if (Date.now() - tempoInicio > 180000) throw new Error("Tempo esgotado.");
            await new Promise(r => setTimeout(r, 2000));

            if (pedido.captchaDigitado) {
                atualizarStatus(pedido.mac, "processando", "Enviando dados de ativação...");
                
                // Preenchimento com pequenos delays para simular humano
                await page.type("input[name='mac']", pedido.mac, { delay: 30 });
                
                const inputKey = await page.$("input[name='key']");
                if (inputKey && pedido.key) await page.type("input[name='key']", pedido.key, { delay: 30 });
                
                await page.type("input[name='captcha']", pedido.captchaDigitado, { delay: 30 });
                
                await Promise.all([
                    page.click("button[type='submit']"),
                    page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {})
                ]);
                resolvido = true;
            }
        }
        atualizarStatus(pedido.mac, "ok", "✅ Comando enviado com sucesso!");

    } catch (error) {
        atualizarStatus(pedido.mac, "erro", "Erro na execução: " + error.message);
    } finally {
        if (browser) await browser.close();
    }
}

module.exports = { executarIboCom };
