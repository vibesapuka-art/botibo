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

        // 1. CLIQUE NOS TERMOS (Melhorado para garantir que o modal suma)
        try {
            const seletorBotao = 'button.bg-main';
            await page.waitForSelector(seletorBotao, { timeout: 15000 });
            await page.click(seletorBotao);
            
            // Aguarda o modal sumir completamente
            await new Promise(r => setTimeout(r, 3500)); 
        } catch (e) {
            // Se o botão falhar, removemos o fundo escuro via código para liberar o formulário
            await page.evaluate(() => {
                document.querySelectorAll('.modal, .modal-backdrop').forEach(el => el.remove());
                document.body.classList.remove('modal-open');
            });
        }

        // 2. CAPTURA DO FORMULÁRIO (Garantindo centralização)
        const seletorForm = '#login-form, form'; 
        await page.waitForSelector(seletorForm, { visible: true, timeout: 20000 });
        const formElement = await page.$(seletorForm);
        
        await formElement.scrollIntoView();
        await new Promise(r => setTimeout(r, 2000));

        const captchaBase64 = await formElement.screenshot({ 
            encoding: 'base64',
            type: 'jpeg',
            quality: 80 
        });

        atualizarStatus(pedido.mac, "aguardando_captcha", "Aguardando captcha...", {
            captchaBase64: `data:image/jpeg;base64,${captchaBase64}`
        });

        // 3. LOOP DE ESPERA PELA RESPOSTA DO USUÁRIO
        let resolvido = false;
        let tempoInicio = Date.now();
        
        while (!resolvido) {
            if (Date.now() - tempoInicio > 180000) throw new Error("Tempo esgotado (3 min).");
            await new Promise(r => setTimeout(r, 2000));

            if (pedido.captchaDigitado) {
                atualizarStatus(pedido.mac, "processando", "Digitando dados no portal...");

                // CORREÇÃO DO ERRO: Espera o campo estar pronto e visível
                await page.waitForSelector("input[name='mac']", { visible: true, timeout: 10000 });
                
                // Limpa o campo antes de digitar (segurança extra)
                await page.click("input[name='mac']", { clickCount: 3 });
                await page.type("input[name='mac']", pedido.mac, { delay: 60 });
                
                const inputKey = await page.$("input[name='key']");
                if (inputKey && pedido.key) {
                    await page.type("input[name='key']", pedido.key, { delay: 60 });
                }
                
                await page.type("input[name='captcha']", pedido.captchaDigitado, { delay: 60 });
                
                // Clique no botão de Login e aguarda resposta
                await Promise.all([
                    page.click("button[type='submit']"),
                    page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {})
                ]);
                
                atualizarStatus(pedido.mac, "ok", "✅ Dispositivo logado!");
                resolvido = true;
            }
        }

    } catch (error) {
        console.error("Erro no robô:", error.message);
        atualizarStatus(pedido.mac, "erro", "Falha: " + error.message);
    } finally {
        if (browser) await browser.close();
    }
}

module.exports = { executarIboCom };
