const puppeteer = require('puppeteer');

async function executarIboCom(pedido, atualizarStatus) {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });

        atualizarStatus(pedido.mac, "acessando_site", "Abrindo portal IBO Player...");
        await page.goto('https://iboplayer.com/device/login', { waitUntil: 'networkidle2' });

        // 1. Preenche os dados básicos
        await page.type("input[placeholder*='Mac Address']", pedido.mac);
        if (pedido.key) {
            await page.type("input[placeholder*='Device Key']", pedido.key);
        }

        // 2. Localiza e espera o Captcha carregar de verdade
        atualizarStatus(pedido.mac, "carregando_captcha", "Localizando verificação de segurança...");
        
        try {
            // Espera o seletor da imagem do captcha aparecer
            await page.waitForSelector('form img', { timeout: 15000 });
            
            // Garante que a imagem tem um SRC válido (não está em branco)
            await page.waitForFunction(() => {
                const img = document.querySelector('form img');
                return img && img.src && img.src.length > 10;
            }, { timeout: 10000 });

            const captchaElement = await page.$('form img');
            const captchaBase64 = await captchaElement.screenshot({ encoding: 'base64' });

            // 3. Envia para o seu index.html mostrar ao cliente
            atualizarStatus(pedido.mac, "aguardando_captcha", "Digite o código que apareceu na tela", {
                captchaBase64: `data:image/png;base64,${captchaBase64}`
            });

            // 4. Espera o cliente digitar no painel (aguarda até o pedido ter o campo captchaDigitado)
            let resolvido = false;
            while (!resolvido) {
                await new Promise(r => setTimeout(r, 2000));
                // Aqui você deve checar no seu objeto de pedidos se o captcha chegou
                if (pedido.captchaDigitado) {
                    await page.type("input[name='captcha']", pedido.captchaDigitado);
                    await page.click("button[type='submit']");
                    resolvido = true;
                }
            }

            atualizarStatus(pedido.mac, "processando", "Autenticação enviada, finalizando...");
            await page.waitForNavigation({ waitUntil: 'networkidle0' });
            atualizarStatus(pedido.mac, "ok", "Acesso liberado com sucesso!");

        } catch (e) {
            console.error("Erro no captcha:", e);
            await page.screenshot({ path: 'debug_screen.png' }); // Salva foto do erro para você ver
            atualizarStatus(pedido.mac, "erro", "Não foi possível carregar o Captcha. Tente novamente.");
        }

    } catch (error) {
        atualizarStatus(pedido.mac, "erro", "Erro técnico: " + error.message);
    } finally {
        await browser.close();
    }
}

module.exports = { executarIboCom };
