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
        await page.setViewport({ width: 1280, height: 1600 });
        
        atualizarStatus(pedido.mac, "acessando_site", "Abrindo portal IBO Player...");
        await page.goto('https://iboplayer.com/device/login', { waitUntil: 'networkidle2', timeout: 60000 });

        // 1. ACEITAR TERMOS (Usando a classe bg-main)
        try {
            const seletorBotao = 'button.bg-main';
            await page.waitForSelector(seletorBotao, { timeout: 10000 });
            await page.click(seletorBotao);
            await new Promise(r => setTimeout(r, 3000));
        } catch (e) {
            await page.evaluate(() => {
                document.querySelectorAll('.modal, .modal-backdrop').forEach(el => el.remove());
                document.body.classList.remove('modal-open');
            });
        }

        // 2. CAPTURA DO FORMULÁRIO (Print para o Captcha)
        const seletorForm = '#login-form, form'; 
        await page.waitForSelector(seletorForm, { visible: true, timeout: 20000 });
        const formElement = await page.$(seletorForm);
        
        await formElement.scrollIntoView();
        const captchaBase64 = await formElement.screenshot({ 
            encoding: 'base64', 
            type: 'jpeg', 
            quality: 80 
        });

        atualizarStatus(pedido.mac, "aguardando_captcha", "Digite o código da imagem:", {
            captchaBase64: `data:image/jpeg;base64,${captchaBase64}`
        });

        // 3. PREENCHIMENTO COM OS NOMES CORRETOS QUE VOCÊ ACHOU
        let resolvido = false;
        let tempoInicio = Date.now();
        
        while (!resolvido) {
            if (Date.now() - tempoInicio > 180000) throw new Error("Tempo esgotado.");
            await new Promise(r => setTimeout(r, 2000));

            if (pedido.captchaDigitado) {
                atualizarStatus(pedido.mac, "processando", "Enviando dados...");

                // USANDO OS SELETORES QUE VOCÊ MANDOU: max-address e device-key
                await page.waitForSelector("input[name='max-address']", { visible: true, timeout: 15000 });
                
                // Limpa e digita o MAC
                await page.click("input[name='max-address']", { clickCount: 3 });
                await page.type("input[name='max-address']", pedido.mac, { delay: 50 });
                
                // Digita a KEY se existir
                if (pedido.key) {
                    await page.type("input[name='device-key']", pedido.key, { delay: 50 });
                }
                
                // Digita o Captcha (Geralmente o name é 'captcha', mantive por segurança)
                await page.type("input[name='captcha']", pedido.captchaDigitado, { delay: 50 });
                
                // Clique final no botão de submit
                await Promise.all([
                    page.click("button[type='submit']"),
                    page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {})
                ]);
                
                atualizarStatus(pedido.mac, "ok", "✅ Logado com sucesso!");
                resolvido = true;
            }
        }

    } catch (error) {
        atualizarStatus(pedido.mac, "erro", "Falha: " + error.message);
    } finally {
        if (browser) await browser.close();
    }
}

module.exports = { executarIboCom };
