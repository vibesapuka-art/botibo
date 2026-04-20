const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

// A função deve ser definida e exportada corretamente
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
            // Seletor ajustado para encontrar a imagem do captcha no formulário
            await page.waitForSelector('form img', { timeout: 20000 });
            
            await page.waitForFunction(() => {
                const img = document.querySelector('form img');
                return img && img.src && img.src.length > 10;
            }, { timeout: 10000 });

            const captchaElement = await page.$('form img');
            const captchaBase64 = await captchaElement.screenshot({ encoding: 'base64' });

            // Envia a imagem para o painel
            atualizarStatus(pedido.mac, "aguardando_captcha", "Digite o código da imagem", {
                captchaBase64: `data:image/png;base64,${captchaBase64}`
            });

            // Loop de espera pela digitação do usuário
            let resolvido = false;
            let inicio = Date.now();
            while (!resolvido) {
                if (Date.now() - inicio > 120000) throw new Error("Tempo esgotado.");
                await new Promise(r => setTimeout(r, 2000));

                if (pedido.captchaDigitado) {
                    atualizarStatus(pedido.mac, "processando", "Enviando dados...");
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
            atualizarStatus(pedido.mac, "erro", "Erro no Captcha: " + e.message);
        }
    } catch (error) {
        atualizarStatus(pedido.mac, "erro", "Erro técnico: " + error.message);
    } finally {
        if (browser) await browser.close();
    }
}

// Exportação crucial para evitar erro de "not a function"
module.exports = { executarIboCom };
