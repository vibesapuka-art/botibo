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

        // --- NOVO: Lógica para aceitar os Termos Legais ---
        try {
            const botaoAceitar = "button.btn-danger, .btn-accept, button:contains('Accept')";
            await page.waitForSelector(botaoAceitar, { timeout: 5000 });
            await page.click(botaoAceitar);
            console.log("Termos aceitos automaticamente.");
            await new Promise(r => setTimeout(r, 2000)); // Espera a transição
        } catch (e) {
            console.log("Aviso de termos não apareceu ou já foi aceito.");
        }
        // -----------------------------------------------------------------------

        atualizarStatus(pedido.mac, "carregando_captcha", "Aguardando imagem do Captcha...");
        
        try {
            // Seletor específico para a imagem do formulário
            const seletorImg = 'form#login-form img, .captcha-img img, img[src*="captcha"]';
            await page.waitForSelector(seletorImg, { timeout: 30000 });

            // Garante que a imagem está visível e carregada
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

            // Espera a resposta do painel
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
            atualizarStatus(pedido.mac, "erro", "Erro ao localizar Captcha. Verifique se o site mudou.");
        }
    } catch (error) {
        atualizarStatus(pedido.mac, "erro", "Falha no robô: " + error.message);
    } finally {
        if (browser) await browser.close();
    }
}

module.exports = { executarIboCom };
