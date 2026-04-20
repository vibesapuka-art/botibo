const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

module.exports = async (pedido) => {
    let browser;
    try {
        browser = await puppeteer.launch({
            args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox"],
            executablePath: await chromium.executablePath(),
            headless: true
        });

        const page = await browser.newPage();
        
        // 1. O BOT ENTRA NO SITE ASSIM QUE O CLIENTE CLICA EM CONFIRMAR
        await page.goto("https://iboplayer.com/device/login", { waitUntil: "networkidle2" });

        let captchaResolvido = false;

        // 2. LOOP DE CAPTCHA (Fica renovando até o cliente digitar)
        while (!captchaResolvido) {
            pedido.mensagem = "Gerando imagem de verificação...";

            // Espera a imagem do captcha carregar no site
            await page.waitForSelector("img[src*='captcha']", { timeout: 10000 });
            const captchaElement = await page.$("img[src*='captcha']");
            
            // Tira o print e envia para o seu painel (index.html)
            const base64 = await captchaElement.screenshot({ encoding: "base64" });
            pedido.captchaBase64 = `data:image/png;base64,${base64}`;
            pedido.status = "aguardando_captcha";
            pedido.mensagem = "Digite o código da imagem acima:";

            // Aguarda 20 segundos pela resposta do cliente
            let inicioEspera = Date.now();
            while (!pedido.captchaDigitado && (Date.now() - inicioEspera < 20000)) {
                await new Promise(r => setTimeout(r, 1000));
            }

            if (pedido.captchaDigitado) {
                // Se o cliente digitou, saímos do loop para logar
                captchaResolvido = true;
            } else {
                // Se não digitou em 20s, o bot dá um refresh para pegar um captcha novo
                pedido.mensagem = "Atualizando imagem expirada...";
                await page.reload({ waitUntil: "networkidle2" });
            }
        }

        // 3. O CLIENTE DIGITOU, AGORA O BOT FAZ O RESTANTE
        pedido.status = "processando";
        pedido.mensagem = "Autenticando e enviando lista...";

        // Preenche os campos de login
        await page.type("#mac", pedido.mac);
        await page.type("#key", pedido.key);
        await page.type("#captcha", pedido.captchaDigitado); // O campo onde digita o captcha
        
        await page.click("button[type='submit']");
        
        // Espera o login ser concluído
        await page.waitForNavigation({ waitUntil: "networkidle2" });

        // 4. ADICIONA A LISTA IMPERIUMTV
        // Aqui o bot navega para a página de adicionar e preenche usuário/senha
        await page.goto("https://iboplayer.com/device/playlists/add", { waitUntil: "networkidle2" });
        
        await page.type("#playlist_name", "ImperiumTv");
        await page.type("#username", pedido.user);
        await page.type("#password", pedido.pass);
        
        await page.click("#save_button"); // Ajuste o ID se o botão de salvar for outro

        // FINALIZAÇÃO
        pedido.status = "ok";
        pedido.mensagem = "✅ IBO PLAYER ativado com sucesso!";

    } catch (err) {
        console.error("Erro no Bot IBO:", err.message);
        pedido.status = "erro";
        pedido.mensagem = "Erro: " + err.message;
    } finally {
        if (browser) await browser.close();
    }
};
