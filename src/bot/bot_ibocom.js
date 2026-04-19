const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

async function executarBotIboCom(pedido) {
    if (!pedido || pedido.tipo !== "ibocom") return;

    let browser;
    try {
        browser = await puppeteer.launch({
            args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox"],
            executablePath: await chromium.executablePath(),
            headless: true
        });

        const page = await browser.newPage();
        await page.goto("https://iboplayer.com/device/login", { waitUntil: "networkidle2" });

        // Se o cliente ainda não resolveu o captcha, tira o print
        if (!pedido.captchaDigitado) {
            const captchaImg = await page.$("img[src*='captcha']");
            if (captchaImg) {
                const buffer = await captchaImg.screenshot({ encoding: "base64" });
                pedido.captchaBase64 = `data:image/png;base64,${buffer}`;
                pedido.status = "aguardando_captcha";
                pedido.mensagem = "Resolva o captcha da imagem.";
            }
            return;
        }

        // Se já tem o captcha, faz o login
        pedido.status = "processando";
        await page.type("input[name='mac_address']", pedido.mac);
        await page.type("input[name='device_key']", pedido.key);
        await page.type("input[name='captcha']", pedido.captchaDigitado);

        await page.click("button[type='submit']");
        await new Promise(r => setTimeout(r, 6000));

        // Lógica de adição de playlist (ajustar seletores conforme o site)
        // ... (seu código de adicionar link M3U) ...

        pedido.status = "ok";
    } catch (e) {
        pedido.status = "erro";
        pedido.mensagem = e.message;
    } finally {
        if (browser) await browser.close();
    }
}

module.exports = executarBotIboCom;
