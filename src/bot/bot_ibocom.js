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
        page.setDefaultNavigationTimeout(60000);

        atualizarStatus(pedido.mac, "acessando_site", "Abrindo portal IBO Player...");
        await page.goto('https://iboplayer.com/device/login', { waitUntil: 'networkidle2' });

        atualizarStatus(pedido.mac, "carregando_captcha", "Aguardando imagem do Captcha...");
        
        try {
            // Seletores múltiplos para garantir que encontra a imagem
            const seletorImg = 'form img[src*="captcha"], img[src^="data:image"], .captcha-img img';
            await page.waitForSelector(seletorImg, { timeout: 30000 });

            // Verifica se a imagem carregou e tem conteúdo visual
            await page.waitForFunction((sel) => {
                const img = document.querySelector(sel);
                return img && img.complete && img.naturalWidth > 0;
            }, { timeout: 15000 }, seletorImg);

            const captchaElement = await page.$(seletorImg);
            await captchaElement.scrollIntoView();
            const captchaBase64 = await captchaElement.screenshot({ encoding: 'base64' });

            atualizarStatus(pedido.mac, "aguardando_captcha", "Digite o código abaixo:", {
                captchaBase64: `data:image/png;base64,${captchaBase64}`
            });

            // Loop de espera pela resposta do utilizador
            let resolvido = false;
            let tempoInicio = Date.now();
            while (!resolvido) {
                if (Date.now() - tempoInicio > 180000) throw new Error("Tempo esgotado.");
                await new Promise(r => setTimeout(r, 2000));

                if (pedido.captchaDigitado) {
                    atualizarStatus(pedido.mac, "processando", "Enviando dados...");
                    await page.type("input[name='mac']", pedido.mac, { delay: 100 });
                    if (pedido.key) await page.type("input[name='key']", pedido.key, { delay: 100 });
                    await page.type("input[name='captcha']", pedido.captchaDigitado, { delay: 100 });
                    
                    await Promise.all([
                        page.click("button[type='submit']"),
                        page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 45000 }).catch(() => {})
                    ]);
                    resolvido = true;
                }
            }
            atualizarStatus(pedido.mac, "ok", "✅ Ativação concluída!");
        } catch (e) {
            atualizarStatus(pedido.mac, "erro", "Erro ao localizar Captcha. Tente novamente.");
        }
    } catch (error) {
        atualizarStatus(pedido.mac, "erro", "Falha no robô: " + error.message);
    } finally {
        if (browser) await browser.close();
    }
}

module.exports = { executarIboCom };
