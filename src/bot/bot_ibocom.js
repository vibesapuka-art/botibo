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
        await page.setViewport({ width: 1280, height: 1400 });
        page.setDefaultNavigationTimeout(60000);

        atualizarStatus(pedido.mac, "acessando_site", "Abrindo portal IBO Player...");
        await page.goto('https://iboplayer.com/device/login', { waitUntil: 'networkidle2' });

        // 1. CLIQUE NO BOTÃO EXATO (bg-main)
        atualizarStatus(pedido.mac, "aceitando_termos", "Clicando em Accept legal terms...");
        
        try {
            const seletorBotao = 'button.bg-main';
            await page.waitForSelector(seletorBotao, { timeout: 15000 });

            await page.evaluate((sel) => {
                const btn = document.querySelector(sel);
                if (btn) {
                    btn.scrollIntoView({ behavior: 'instant', block: 'center' });
                    btn.click();
                }
            }, seletorBotao);
            
            // Espera a animação do modal sumir para liberar o formulário
            await new Promise(r => setTimeout(r, 3000));
        } catch (e) {
            console.log("Botão não encontrado, tentando limpar modais por segurança...");
            await page.evaluate(() => {
                document.querySelectorAll('.modal, .modal-backdrop').forEach(el => el.remove());
                document.body.classList.remove('modal-open');
            });
        }

        // 2. FOCO NO FORMULÁRIO DE LOGIN
        atualizarStatus(pedido.mac, "carregando_captcha", "Localizando formulário...");

        const seletorForm = '#login-form, form'; 
        await page.waitForSelector(seletorForm, { timeout: 20000 });

        // Rola até o formulário para garantir que o captcha esteja visível
        const formElement = await page.$(seletorForm);
        await formElement.scrollIntoView();

        // Aguarda um instante para o captcha carregar completamente
        await new Promise(r => setTimeout(r, 2000));

        // Tira o print APENAS do formulário de login (onde está o captcha)
        const captchaBase64 = await formElement.screenshot({ 
            encoding: 'base64',
            type: 'jpeg',
            quality: 80 
        });

        atualizarStatus(pedido.mac, "aguardando_captcha", "Digite o código da imagem:", {
            captchaBase64: `data:image/jpeg;base64,${captchaBase64}`
        });

        // 3. ESPERA PELA DIGITAÇÃO
        let resolvido = false;
        let tempoInicio = Date.now();
        while (!resolvido) {
            if (Date.now() - tempoInicio > 180000) throw new Error("Tempo esgotado.");
            await new Promise(r => setTimeout(r, 2000));

            if (pedido.captchaDigitado) {
                atualizarStatus(pedido.mac, "processando", "Enviando dados...");
                
                await page.type("input[name='mac']", pedido.mac, { delay: 20 });
                const temKey = await page.$("input[name='key']");
                if (temKey && pedido.key) await page.type("input[name='key']", pedido.key, { delay: 20 });
                
                await page.type("input[name='captcha']", pedido.captchaDigitado, { delay: 20 });
                
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
