const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

/**
 * Função para automatizar o login no iboplayer.com
 */
async function executarIboCom(pedido, atualizarStatus) {
    let browser;
    try {
        browser = await puppeteer.launch({
            args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox"],
            executablePath: await chromium.executablePath(),
            headless: true
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });

        atualizarStatus(pedido.mac, "acessando_site", "Abrindo portal IBO Player...");
        await page.goto('https://iboplayer.com/device/login', { 
            waitUntil: 'networkidle2',
            timeout: 60000 
        });

        atualizarStatus(pedido.mac, "carregando_captcha", "Localizando verificação de segurança...");
        
        try {
            // Seletor específico: busca a imagem que está logo após o label do Captcha
            const captchaSelector = 'label[for="captcha"] + img';
            await page.waitForSelector(captchaSelector, { timeout: 20000 });
            
            // Garante que a imagem carregou os dados
            await page.waitForFunction((sel) => {
                const img = document.querySelector(sel);
                return img && img.src && img.src.length > 20;
            }, { timeout: 10000 }, captchaSelector);

            const captchaElement = await page.$(captchaSelector);
            const captchaBase64 = await captchaElement.screenshot({ encoding: 'base64' });

            // Envia a imagem para o seu index.html mostrar ao cliente
            atualizarStatus(pedido.mac, "aguardando_captcha", "Por favor, digite o código da imagem", {
                captchaBase64: `data:image/png;base64,${captchaBase64}`
            });

            // Loop de espera pela resposta do cliente através do painel
            let resolvido = false;
            let tempoInicio = Date.now();
            
            while (!resolvido) {
                // Limite de 2 minutos para o cliente responder
                if (Date.now() - tempoInicio > 120000) {
                    throw new Error("Tempo esgotado para digitação do captcha.");
                }

                await new Promise(r => setTimeout(r, 2000));

                if (pedido.captchaDigitado) {
                    atualizarStatus(pedido.mac, "processando", "Validando dados no servidor...");
                    
                    // Preenche os campos conforme o site
                    await page.type("input[name='mac']", pedido.mac);
                    if (pedido.key) {
                        await page.type("input[name='key']", pedido.key);
                    }
                    await page.type("input[name='captcha']", pedido.captchaDigitado);
                    
                    await page.click("button[type='submit']");
                    resolvido = true;
                }
            }

            // Aguarda a navegação após o login
            await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 });
            atualizarStatus(pedido.mac, "ok", "✅ Lista ImperiumTv enviada com sucesso!");

        } catch (e) {
            console.error("Erro no captcha:", e.message);
            atualizarStatus(pedido.mac, "erro", "Falha ao processar Captcha: " + e.message);
        }

    } catch (error) {
        console.error("Erro Geral:", error.message);
        atualizarStatus(pedido.mac, "erro", "Erro técnico: " + error.message);
    } finally {
        if (browser) await browser.close();
    }
}

module.exports = { executarIboCom };
