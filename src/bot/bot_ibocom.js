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
        // Viewport ajustada para capturar o formulário de login e o captcha
        await page.setViewport({ width: 1280, height: 1200 });
        page.setDefaultNavigationTimeout(60000);

        atualizarStatus(pedido.mac, "acessando_site", "Abrindo portal IBO Player...");
        await page.goto('https://iboplayer.com/device/login', { waitUntil: 'networkidle2' });

        // --- TÉCNICA DE LIMPEZA FORÇADA (DELETAR MODAL) ---
        atualizarStatus(pedido.mac, "limpando_tela", "Removendo bloqueios visuais...");
        
        await page.evaluate(() => {
            // Seletores de tudo que pode estar na frente do captcha
            const seletoresBloqueio = [
                '.modal', '.modal-backdrop', '#cookie-law-info-bar', 
                '.fade.show', 'div[role="dialog"]', '.btn-danger', '.btn-accept'
            ];
            
            seletoresBloqueio.forEach(sel => {
                document.querySelectorAll(sel).forEach(el => el.remove());
            });

            // Destrava o scroll e a interação com o fundo da página
            document.body.classList.remove('modal-open');
            document.body.style.overflow = 'auto';
            document.body.style.pointerEvents = 'auto';
        });

        // Espera 5 segundos para garantir que o formulário carregou atrás do aviso
        await new Promise(r => setTimeout(r, 5000));

        // Rola um pouco para baixo para centralizar o formulário no print
        await page.evaluate(() => window.scrollBy(0, 350));

        const printTela = await page.screenshot({ 
            encoding: 'base64',
            fullPage: false 
        });

        atualizarStatus(pedido.mac, "aguardando_captcha", "Digite o código que aparece na imagem:", {
            captchaBase64: `data:image/png;base64,${printTela}`
        });

        // --- ESPERA PELA RESPOSTA DO UTILIZADOR ---
        let resolvido = false;
        let tempoInicio = Date.now();
        while (!resolvido) {
            if (Date.now() - tempoInicio > 180000) throw new Error("Tempo esgotado.");
            await new Promise(r => setTimeout(r, 2000));

            if (pedido.captchaDigitado) {
                atualizarStatus(pedido.mac, "processando", "Enviando dados de ativação...");
                
                // Preenchimento dos campos
                await page.type("input[name='mac']", pedido.mac, { delay: 30 });
                
                const temKey = await page.$("input[name='key']");
                if (temKey && pedido.key) {
                    await page.type("input[name='key']", pedido.key, { delay: 30 });
                }
                
                await page.type("input[name='captcha']", pedido.captchaDigitado, { delay: 30 });
                
                // Clica no botão de login do site
                await Promise.all([
                    page.click("button[type='submit']"),
                    page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {})
                ]);
                
                // Aqui você pode adicionar a lógica para inserir os DNS após o login
                atualizarStatus(pedido.mac, "ok", "✅ Ativado com sucesso!");
                resolvido = true;
            }
        }

    } catch (error) {
        atualizarStatus(pedido.mac, "erro", "Erro: " + error.message);
    } finally {
        if (browser) await browser.close();
    }
}

module.exports = { executarIboCom };
