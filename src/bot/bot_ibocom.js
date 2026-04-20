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

        // 1. CLIQUE NOS TERMOS E LIMPEZA DE TELA
        try {
            const seletorBotao = 'button.bg-main';
            await page.waitForSelector(seletorBotao, { timeout: 15000 });
            await page.click(seletorBotao);
            
            // Pausa maior para o site processar o fechamento do modal
            await new Promise(r => setTimeout(r, 4000)); 
        } catch (e) {
            // Se o botão falhar ou o modal travar, removemos tudo que bloqueia o fundo
            await page.evaluate(() => {
                document.querySelectorAll('.modal, .modal-backdrop, #terms-modal').forEach(el => el.remove());
                document.body.classList.remove('modal-open');
                document.body.style.overflow = 'auto';
            });
        }

        // 2. CAPTURA DO FORMULÁRIO
        const seletorForm = '#login-form, form'; 
        // Aumentamos o tempo de espera para 20 segundos aqui para evitar a falha
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

        // 3. LOGICA DE PREENCHIMENTO PÓS-RESPOSTA
        let resolvido = false;
        let tempoInicio = Date.now();
        
        while (!resolvido) {
            if (Date.now() - tempoInicio > 180000) throw new Error("Tempo esgotado.");
            await new Promise(r => setTimeout(r, 2000));

            if (pedido.captchaDigitado) {
                atualizarStatus(pedido.mac, "processando", "Digitando dados...");

                // CORREÇÃO: Espera o input MAC estar visível por até 15 segundos
                await page.waitForSelector("input[name='mac']", { visible: true, timeout: 15000 });
                
                // Simula clique real no campo antes de digitar
                await page.click("input[name='mac']", { clickCount: 3 });
                await page.type("input[name='mac']", pedido.mac, { delay: 70 });
                
                const inputKey = await page.$("input[name='key']");
                if (inputKey && pedido.key) {
                    await page.type("input[name='key']", pedido.key, { delay: 70 });
                }
                
                await page.type("input[name='captcha']", pedido.captchaDigitado, { delay: 70 });
                
                // Clique no Login e espera a navegação
                await Promise.all([
                    page.click("button[type='submit']"),
                    page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {})
                ]);
                
                atualizarStatus(pedido.mac, "ok", "✅ Logado com sucesso!");
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
