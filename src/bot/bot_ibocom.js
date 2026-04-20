const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

async function executarIboCom(pedido, atualizarStatus) {
    let browser;
    try {
        // Configuração necessária para rodar no Render sem erro de "Module Not Found"
        browser = await puppeteer.launch({
            args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox"],
            executablePath: await chromium.executablePath(),
            headless: true
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });

        // 1. ACESSA O SITE
        atualizarStatus(pedido.mac, "acessando_site", "Abrindo portal IBO Player...");
        await page.goto('https://iboplayer.com/device/login', { 
            waitUntil: 'networkidle2',
            timeout: 60000 
        });

        // 2. LOCALIZA O CAPTCHA
        atualizarStatus(pedido.mac, "carregando_captcha", "Localizando verificação de segurança...");
        
        try {
            // Espera a imagem do captcha aparecer
            await page.waitForSelector('form img', { timeout: 15000 });
            
            // Garante que a imagem carregou o conteúdo
            await page.waitForFunction(() => {
                const img = document.querySelector('form img');
                return img && img.src && img.src.length > 10;
            }, { timeout: 10000 });

            const captchaElement = await page.$('form img');
            const captchaBase64 = await captchaElement.screenshot({ encoding: 'base64' });

            // 3. ENVIA PARA O PAINEL (index.html)
            atualizarStatus(pedido.mac, "aguardando_captcha", "Digite o código que apareceu na tela", {
                captchaBase64: `data:image/png;base64,${captchaBase64}`
            });

            // 4. ESPERA RESPOSTA DO CLIENTE
            let resolvido = false;
            let tempoInicio = Date.now();
            
            while (!resolvido) {
                // Timeout de 2 minutos para não travar o servidor
                if (Date.now() - tempoInicio > 120000) {
                    throw new Error("Tempo esgotado para digitação.");
                }

                await new Promise(r => setTimeout(r, 2000));

                if (pedido.captchaDigitado) {
                    atualizarStatus(pedido.mac, "processando", "Validando login...");
                    
                    // Preenche os campos
                    await page.type("input[name='mac']", pedido.mac);
                    if (pedido.key) {
                        await page.type("input[name='key']", pedido.key);
                    }
                    await page.type("input[name='captcha']", pedido.captchaDigitado);
                    
                    await page.click("button[type='submit']");
                    resolvido = true;
                }
            }

            // 5. FINALIZAÇÃO
            await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 });
            atualizarStatus(pedido.mac, "ok", "✅ IBO Player configurado com sucesso!");

        } catch (e) {
            console.error("Erro no captcha:", e.message);
            atualizarStatus(pedido.mac, "erro", "Falha ao carregar Captcha. Tente novamente.");
        }

    } catch (error) {
        console.error("Erro Geral:", error.message);
        atualizarStatus(pedido.mac, "erro", "Erro técnico: " + error.message);
    } finally {
        if (browser) await browser.close();
    }
}

module.exports = { executarIboCom };
