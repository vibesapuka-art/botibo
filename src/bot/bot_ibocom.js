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

        // 1. CLIQUE NOS TERMOS (Classe bg-main extraída da fonte)
        try {
            const seletorBotao = 'button.bg-main';
            await page.waitForSelector(seletorBotao, { timeout: 10000 });
            await page.click(seletorBotao);
            
            // Aguarda o sumiço do modal para liberar o formulário
            await new Promise(r => setTimeout(r, 3000));
        } catch (e) {
            // Se o botão não aparecer, tenta limpar a tela manualmente
            await page.evaluate(() => {
                document.querySelectorAll('.modal, .modal-backdrop').forEach(el => el.remove());
                document.body.classList.remove('modal-open');
            });
        }

        // 2. CAPTURA DO FORMULÁRIO (Foco no Captcha)
        const seletorForm = '#login-form, form'; 
        await page.waitForSelector(seletorForm, { timeout: 15000 });
        const formElement = await page.$(seletorForm);
        
        await formElement.scrollIntoView();
        await new Promise(r => setTimeout(r, 2000));

        const captchaBase64 = await formElement.screenshot({ 
            encoding: 'base64',
            type: 'jpeg',
            quality: 80 
        });

        // Envia para o seu painel INTERACAO_CLIENTE
        atualizarStatus(pedido.mac, "aguardando_captcha", "Digite o código da imagem:", {
            captchaBase64: `data:image/jpeg;base64,${captchaBase64}`
        });

        // 3. ESPERA PELA RESPOSTA DO USUÁRIO
        let resolvido = false;
        let tempoInicio = Date.now();
        
        while (!resolvido) {
            if (Date.now() - tempoInicio > 180000) throw new Error("Tempo esgotado.");
            await new Promise(r => setTimeout(r, 2000));

            if (pedido.captchaDigitado) {
                atualizarStatus(pedido.mac, "processando", "Autenticando...");

                // GARANTIA: Espera o campo MAC estar pronto para digitação
                await page.waitForSelector("input[name='mac']", { visible: true, timeout: 5000 });
                
                // Preenchimento com pequenos atrasos para simular humano
                await page.type("input[name='mac']", pedido.mac, { delay: 40 });
                
                const inputKey = await page.$("input[name='key']");
                if (inputKey && pedido.key) {
                    await page.type("input[name='key']", pedido.key, { delay: 40 });
                }
                
                await page.type("input[name='captcha']", pedido.captchaDigitado, { delay: 40 });
                
                // Clique final no Login
                await Promise.all([
                    page.click("button[type='submit']"),
                    page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {})
                ]);
                
                atualizarStatus(pedido.mac, "ok", "✅ Dispositivo vinculado!");
                resolvido = true;
            }
        }

    } catch (error) {
        console.error("Erro no Bot:", error.message);
        atualizarStatus(pedido.mac, "erro", "Falha: " + error.message);
    } finally {
        if (browser) await browser.close();
    }
}

module.exports = { executarIboCom };
