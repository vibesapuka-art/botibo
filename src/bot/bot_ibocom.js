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
        page.setDefaultNavigationTimeout(60000);

        atualizarStatus(pedido.mac, "acessando_site", "Abrindo portal IBO Player...");
        await page.goto('https://iboplayer.com/device/login', { waitUntil: 'networkidle2' });

        // 1. CLIQUE NO BOTÃO DE TERMOS (Usando a classe bg-main que você achou)
        atualizarStatus(pedido.mac, "aceitando_termos", "Limpando avisos legais...");
        
        try {
            const seletorBotao = 'button.bg-main';
            await page.waitForSelector(seletorBotao, { timeout: 10000 });

            await page.evaluate((sel) => {
                const btn = document.querySelector(sel);
                if (btn) btn.click();
            }, seletorBotao);
            
            // Aguarda o modal sumir da frente do formulário
            await new Promise(r => setTimeout(r, 2500));
        } catch (e) {
            // Fallback: remove na força se o botão falhar
            await page.evaluate(() => {
                document.querySelectorAll('.modal, .modal-backdrop').forEach(el => el.remove());
                document.body.classList.remove('modal-open');
            });
        }

        // 2. CAPTURA DO FORMULÁRIO (Onde o print deu certo agora!)
        const seletorForm = '#login-form, form'; 
        await page.waitForSelector(seletorForm, { timeout: 15000 });
        const formElement = await page.$(seletorForm);
        
        // Garante que o formulário está visível para o print
        await formElement.scrollIntoView();
        await new Promise(r => setTimeout(r, 1500));

        const captchaBase64 = await formElement.screenshot({ 
            encoding: 'base64',
            type: 'jpeg',
            quality: 80 
        });

        atualizarStatus(pedido.mac, "aguardando_captcha", "Aguardando código...", {
            captchaBase64: `data:image/jpeg;base64,${captchaBase64}`
        });

        // 3. LOGICA DE ESPERA E PREENCHIMENTO
        let resolvido = false;
        let tempoInicio = Date.now();
        
        while (!resolvido) {
            if (Date.now() - tempoInicio > 180000) throw new Error("Tempo esgotado (3 min).");
            await new Promise(r => setTimeout(r, 2000));

            if (pedido.captchaDigitado) {
                atualizarStatus(pedido.mac, "processando", "Logando no painel...");
                
                // Preenche os campos usando seletores genéricos para evitar erros se mudarem o ID
                await page.type("input[name='mac']", pedido.mac, { delay: 30 });
                
                const inputs = await page.$$("input[name='key']");
                if (inputs.length > 0 && pedido.key) {
                    await page.type("input[name='key']", pedido.key, { delay: 30 });
                }
                
                await page.type("input[name='captcha']", pedido.captchaDigitado, { delay: 30 });
                
                // Clica no botão de Login do formulário
                await Promise.all([
                    page.evaluate(() => {
                        const btnLogin = document.querySelector("button[type='submit']") || document.querySelector(".btn-main");
                        if (btnLogin) btnLogin.click();
                    }),
                    page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {})
                ]);
                
                atualizarStatus(pedido.mac, "ok", "✅ Logado! Pronto para carregar lista.");
                resolvido = true;
            }
        }

    } catch (error) {
        atualizarStatus(pedido.mac, "erro", "Erro no robô: " + error.message);
    } finally {
        if (browser) await browser.close();
    }
}

module.exports = { executarIboCom };
