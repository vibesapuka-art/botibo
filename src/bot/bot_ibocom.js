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

        // --- LOCALIZAR E CLICAR NO BOTÃO VERMELHO ---
        atualizarStatus(pedido.mac, "aceitando_termos", "Clicando em Accept legal terms...");
        
        try {
            // Aguarda o botão vermelho aparecer na tela
            await page.waitForSelector('button.btn-danger', { timeout: 15000 });

            // Usa JavaScript dentro do navegador para clicar no botão que contém o texto exato
            await page.evaluate(() => {
                const botoes = Array.from(document.querySelectorAll('button.btn-danger'));
                const botaoAlvo = botoes.find(btn => btn.innerText.includes('Accept legal terms'));
                
                if (botaoAlvo) {
                    botaoAlvo.click();
                    // Remove o fundo escuro manualmente caso o clique não feche o modal
                    setTimeout(() => {
                        const backdrop = document.querySelector('.modal-backdrop');
                        if (backdrop) backdrop.remove();
                        document.body.classList.remove('modal-open');
                    }, 500);
                }
            });
            
            // Espera a animação de fechamento do modal
            await new Promise(r => setTimeout(r, 3000)); 
        } catch (e) {
            console.log("Botão de termos não encontrado ou já fechado.");
        }
        // -----------------------------------------------------------------------------

        atualizarStatus(pedido.mac, "carregando_captcha", "Localizando Captcha...");

        // Seletor focado na imagem do formulário de login
        const seletorImg = '#login-form img, img[src*="captcha"]';
        
        await page.waitForSelector(seletorImg, { timeout: 30000 });

        // Centraliza o captcha para garantir que o print não saia cortado
        await page.evaluate((sel) => {
            document.querySelector(sel).scrollIntoView({block: "center"});
        }, seletorImg);

        const captchaElement = await page.$(seletorImg);
        const captchaBase64 = await captchaElement.screenshot({ encoding: 'base64' });

        atualizarStatus(pedido.mac, "aguardando_captcha", "Digite o código:", {
            captchaBase64: `data:image/png;base64,${captchaBase64}`
        });

        // Espera o Jefferson digitar no painel
        let resolvido = false;
        let tempoInicio = Date.now();
        while (!resolvido) {
            if (Date.now() - tempoInicio > 180000) throw new Error("Tempo esgotado.");
            await new Promise(r => setTimeout(r, 2000));

            if (pedido.captchaDigitado) {
                atualizarStatus(pedido.mac, "processando", "Enviando dados...");
                await page.type("input[name='mac']", pedido.mac);
                
                const temKey = await page.$("input[name='key']");
                if (temKey && pedido.key) await page.type("input[name='key']", pedido.key);
                
                await page.type("input[name='captcha']", pedido.captchaDigitado);
                
                await Promise.all([
                    page.click("button[type='submit']"),
                    page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {})
                ]);
                resolvido = true;
            }
        }
        atualizarStatus(pedido.mac, "ok", "✅ Dispositivo Ativado!");

    } catch (error) {
        // Se der erro de timeout, envia o print do erro para debug
        const erroPrint = await page.screenshot({ encoding: 'base64' });
        atualizarStatus(pedido.mac, "erro", "Erro no Captcha: " + error.message, {
            captchaBase64: `data:image/png;base64,${erroPrint}`
        });
    } finally {
        if (browser) await browser.close();
    }
}

module.exports = { executarIboCom };
