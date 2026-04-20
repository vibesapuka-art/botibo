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
        await page.setViewport({ width: 1280, height: 1200 });
        page.setDefaultNavigationTimeout(60000);

        atualizarStatus(pedido.mac, "acessando_site", "Abrindo site oficial...");
        await page.goto('https://iboplayer.com/device/login', { waitUntil: 'networkidle2' });

        let interagindo = true;
        let tempoInicio = Date.now();

        while (interagindo) {
            // Verifica timeout de 5 minutos para não travar o servidor
            if (Date.now() - tempoInicio > 300000) throw new Error("Tempo de interação esgotado.");

            // Tira print do estado ATUAL da tela
            const printBase64 = await page.screenshot({ encoding: 'base64' });
            
            atualizarStatus(pedido.mac, "interacao_cliente", "Clique na imagem para interagir:", {
                captchaBase64: `data:image/png;base64,${printBase64}`,
                aguardandoClique: true
            });

            // Espera o cliente clicar ou digitar o captcha
            // O painel deve atualizar o objeto 'pedido' com cliqueX e cliqueY
            await new Promise(r => setTimeout(r, 3000));

            if (pedido.cliqueSolicitado) {
                // Executa o clique nas coordenadas enviadas pelo cliente
                await page.mouse.click(pedido.cliqueX, pedido.cliqueY);
                pedido.cliqueSolicitado = false; // Reseta o pedido de clique
                console.log(`Clique executado em: X:${pedido.cliqueX} Y:${pedido.cliqueY}`);
            }

            if (pedido.captchaDigitado) {
                // Se o cliente já digitou o captcha, saímos do loop de interação
                interagindo = false;
            }
        }

        // --- PROCESSO DE LOGIN FINAL ---
        atualizarStatus(pedido.mac, "processando", "Finalizando login...");
        await page.type("input[name='mac']", pedido.mac);
        if (pedido.key) await page.type("input[name='key']", pedido.key);
        await page.type("input[name='captcha']", pedido.captchaDigitado);
        
        await Promise.all([
            page.click("button[type='submit']"),
            page.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => {})
        ]);

        atualizarStatus(pedido.mac, "ok", "✅ Logado! Agora o bot assume o DNS.");

    } catch (error) {
        atualizarStatus(pedido.mac, "erro", "Erro: " + error.message);
    } finally {
        if (browser) await browser.close();
    }
}

module.exports = { executarIboCom };
