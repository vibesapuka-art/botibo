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
        // Aumentamos o tempo de espera global para 60 segundos
        page.setDefaultNavigationTimeout(60000);

        atualizarStatus(pedido.mac, "acessando_site", "Abrindo portal IBO Player...");
        await page.goto('https://iboplayer.com/device/login', { 
            waitUntil: 'networkidle2' 
        });

        atualizarStatus(pedido.mac, "carregando_captcha", "Aguardando imagem do Captcha...");
        
        try {
            // 1. ESPERA PELO ELEMENTO: Tenta encontrar a imagem do captcha de várias formas
            const seletorImg = 'form img[src*="captcha"], label[for="captcha"] + img, img[src^="data:image"]';
            await page.waitForSelector(seletorImg, { timeout: 30000 });

            // 2. VALIDAÇÃO DE CARREGAMENTO: Garante que a imagem não está "quebrada"
            await page.waitForFunction((sel) => {
                const img = document.querySelector(sel);
                return img && img.complete && img.naturalWidth > 0 && img.src.length > 20;
            }, { timeout: 15000 }, seletorImg);

            const captchaElement = await page.$(seletorImg);
            
            // Centraliza a imagem antes do print para evitar capturas pretas
            await captchaElement.scrollIntoView();
            const captchaBase64 = await captchaElement.screenshot({ encoding: 'base64' });

            // Envia para o painel
            atualizarStatus(pedido.mac, "aguardando_captcha", "Digite o código abaixo:", {
                captchaBase64: `data:image/png;base64,${captchaBase64}`
            });

            // Loop de espera pela resposta do usuário no painel
            let resolvido = false;
            let tempoInicio = Date.now();
            while (!resolvido) {
                if (Date.now() - tempoInicio > 180000) throw new Error("Tempo de espera (3 min) esgotado.");
                await new Promise(r => setTimeout(r, 2000));

                if (pedido.captchaDigitado) {
                    atualizarStatus(pedido.mac, "processando", "Enviando dados para o site...");
                    
                    // Preenche os campos
                    await page.type("input[name='mac']", pedido.mac, { delay: 100 });
                    if (pedido.key) {
                        await page.type("input[name='key']", pedido.key, { delay: 100 });
                    }
                    await page.type("input[name='captcha']", pedido.captchaDigitado, { delay: 100 });
                    
                    // Clica e aguarda a resposta do site
                    await Promise.all([
                        page.click("button[type='submit']"),
                        page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 45000 }).catch(() => {})
                    ]);
                    resolvido = true;
                }
            }

            atualizarStatus(pedido.mac, "ok", "✅ Ativação concluída com sucesso!");

        } catch (e) {
            console.error("Erro interno:", e.message);
            atualizarStatus(pedido.mac, "erro", "Erro ao carregar Captcha. Verifique sua conexão e tente novamente.");
        }
    } catch (error) {
        console.error("Erro Geral:", error.message);
        atualizarStatus(pedido.mac, "erro", "O robô não conseguiu iniciar: " + error.message);
    } finally {
        if (browser) await browser.close();
    }
}

module.exports = { executarIboCom };
