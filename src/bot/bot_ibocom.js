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
        await page.setViewport({ width: 1280, height: 900 });

        atualizarStatus(pedido.mac, "acessando_site", "Abrindo portal IBO Player...");
        await page.goto('https://iboplayer.com/device/login', { 
            waitUntil: 'networkidle2',
            timeout: 60000 
        });

        // Espera um pouco para o site carregar scripts internos
        await new Promise(r => setTimeout(r, 5000));

        atualizarStatus(pedido.mac, "carregando_captcha", "Localizando código de segurança...");
        
        try {
            // Tenta localizar a imagem pelo seletor que funcionou no print anterior
            const seletores = [
                'label[for="captcha"] + img',
                'form img[src*="captcha"]',
                'img[src^="data:image/png"]'
            ];

            let captchaElement = null;
            for (const sel of seletores) {
                try {
                    await page.waitForSelector(sel, { timeout: 10000 });
                    captchaElement = await page.$(sel);
                    if (captchaElement) break;
                } catch (e) { continue; }
            }

            if (!captchaElement) throw new Error("Captcha não encontrado na página.");

            await captchaElement.scrollIntoView();
            const captchaBase64 = await captchaElement.screenshot({ encoding: 'base64' });

            atualizarStatus(pedido.mac, "aguardando_captcha", "Digite as letras abaixo:", {
                captchaBase64: `data:image/png;base64,${captchaBase64}`
            });

            // Espera resposta do painel
            let resolvido = false;
            let inicio = Date.now();
            while (!resolvido) {
                if (Date.now() - inicio > 180000) throw new Error("Tempo limite de 3 minutos esgotado.");
                await new Promise(r => setTimeout(r, 2000));

                if (pedido.captchaDigitado) {
                    atualizarStatus(pedido.mac, "processando", "Validando acesso...");
                    await page.type("input[name='mac']", pedido.mac);
                    if (pedido.key) await page.type("input[name='key']", pedido.key);
                    await page.type("input[name='captcha']", pedido.captchaDigitado);
                    
                    await page.click("button[type='submit']");
                    resolvido = true;
                }
            }

            await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 });
            atualizarStatus(pedido.mac, "ok", "✅ Ativado com sucesso!");

        } catch (e) {
            console.error("Erro interno:", e.message);
            atualizarStatus(pedido.mac, "erro", "Erro ao carregar Captcha: " + e.message);
        }
    } catch (error) {
        atualizarStatus(pedido.mac, "erro", "Erro de conexão: " + error.message);
    } finally {
        if (browser) await browser.close();
    }
}

// Exportando exatamente com este nome para o index.js encontrar
module.exports = { executarIboCom };
