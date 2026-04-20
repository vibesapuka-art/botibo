const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

module.exports = async (pedido) => {
    let browser;
    try {
        browser = await puppeteer.launch({
            args: [...chromium.args, "--no-sandbox"],
            executablePath: await chromium.executablePath(),
            headless: true
        });

        const page = await browser.newPage();
        await page.goto("https://iboplayer.com/device/login", { waitUntil: "networkidle2" });

        // Espera a imagem do captcha e o botão de refresh que você viu no print
        await page.waitForSelector("img[src*='captcha']", { timeout: 20000 });
        
        // Captura a imagem em Base64
        const captchaElement = await page.$("img[src*='captcha']");
        const base64 = await captchaElement.screenshot({ encoding: "base64" });

        // ATUALIZA O PEDIDO PARA O FRONT-END REAGIR
        pedido.captchaBase64 = `data:image/png;base64,${base64}`;
        pedido.status = "aguardando_captcha"; // Mudança de status crucial
        pedido.mensagem = "Imagem carregada. Digite o código:";

        // Espera o cliente digitar no painel (o index.html deve preencher pedido.captchaDigitado)
        let tentativa = 0;
        while (!pedido.captchaDigitado && tentativa < 30) {
            await new Promise(r => setTimeout(r, 1000));
            tentativa++;
        }

        if (!pedido.captchaDigitado) throw new Error("Tempo esgotado para o captcha.");

        // Preenche os dados no site do IBO
        await page.type("input[name='mac']", pedido.mac);
        await page.type("input[name='key']", pedido.key);
        await page.type("input[name='captcha']", pedido.captchaDigitado);
        
        await page.click("button[type='submit']");
        await page.waitForNavigation();

        pedido.status = "ok";
        pedido.mensagem = "✅ Login realizado!";

    } catch (err) {
        pedido.status = "erro";
        pedido.mensagem = err.message;
    } finally {
        if (browser) await browser.close();
    }
};
