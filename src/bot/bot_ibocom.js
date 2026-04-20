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
        // Ajustamos o tamanho para pegar o formulário e o captcha sem cortes
        await page.setViewport({ width: 1280, height: 1200 });
        page.setDefaultNavigationTimeout(60000);

        atualizarStatus(pedido.mac, "acessando_site", "Abrindo portal IBO Player...");
        await page.goto('https://iboplayer.com/device/login', { waitUntil: 'networkidle2' });

        // 1. CLICAR NO BOTÃO VERMELHO
        atualizarStatus(pedido.mac, "aceitando_termos", "Clicando no botão vermelho...");
        
        try {
            const seletorBotao = 'button.btn-danger';
            await page.waitForSelector(seletorBotao, { timeout: 15000 });

            await page.evaluate((sel) => {
                const btn = document.querySelector(sel);
                if (btn) {
                    btn.scrollIntoView();
                    btn.click();
                }
            }, seletorBotao);
            
            console.log("Clique efetuado.");
        } catch (e) {
            console.log("Botão não encontrado, tentando prosseguir...");
        }

        // 2. AGUARDAR 5 SEGUNDOS E TIRAR PRINT DA TELA INTEIRA
        atualizarStatus(pedido.mac, "carregando_captcha", "Aguardando 5 segundos para o print...");
        await new Promise(r => setTimeout(r, 5000));

        // Rola um pouco para baixo para garantir que o formulário apareça no centro
        await page.evaluate(() => window.scrollBy(0, 300));

        const printTelaCheia = await page.screenshot({ 
            encoding: 'base64',
            fullPage: false // Captura a área visível do viewport definido acima
        });

        atualizarStatus(pedido.mac, "aguardando_captcha", "Veja o código na imagem abaixo:", {
            captchaBase64: `data:image/png;base64,${printTelaCheia}`
        });

        // 3. ESPERA A RESPOSTA DO PAINEL
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
        atualizarStatus(pedido.mac, "erro", "Erro: " + error.message);
    } finally {
        if (browser) await browser.close();
    }
}

module.exports = { executarIboCom };
