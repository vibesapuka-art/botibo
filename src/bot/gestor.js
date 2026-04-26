const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

module.exports = async (pedido, pageExistente = null) => {
    let browser;
    let page = pageExistente;

    try {
        const loginFinal = pedido.usuario_iptv || pedido.user || "";
        const senhaFinal = pedido.senha_iptv || pedido.pass || "";

        if (!page) {
            const executablePath = await chromium.executablePath();
            browser = await puppeteer.launch({
                args: [
                    ...chromium.args, 
                    "--no-sandbox", 
                    "--disable-web-security",
                    "--disable-features=IsolateOrigins,site-per-process" // Ajuda a interagir com Iframes
                ],
                executablePath: executablePath,
                headless: chromium.headless,
            });
            page = await browser.newPage();
            // User agent de um Chrome real no Windows
            await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36");
        }

        await page.goto("https://gestorv3.pro/imperiumtv/central/registrar/", { waitUntil: "networkidle2" });
        
        // Simula movimento aleatório do mouse para "aquecer" o reCAPTCHA
        await page.mouse.move(100, 100);
        await page.mouse.move(200, 300);

        const preencherLento = async (id, valor) => {
            await page.click(id);
            await page.keyboard.type(String(valor || ""), { delay: Math.floor(Math.random() * 100) + 50 });
        };

        await preencherLento('#nome', pedido.nome);
        await preencherLento('#sobrenome', pedido.sobrenome);
        await preencherLento('#user', loginFinal);
        await preencherLento('#pass', senhaFinal);
        if (pedido.whatsapp) await preencherLento('#whatsapp', pedido.whatsapp);

        // --- INTERAÇÃO COM O CAPTCHA ---
        console.log("🤖 Tentando marcar o captcha de forma humana...");
        const frameHandle = await page.waitForSelector('iframe[src*="api2/anchor"]');
        const frame = await frameHandle.contentFrame();
        
        // Clica no checkbox do captcha
        await frame.click('#recaptcha-anchor', { delay: 500 });

        // Espera longa (o Google analisa seu comportamento aqui)
        await new Promise(r => setTimeout(r, 15000)); 

        // Em vez de forçar o submit, vamos clicar no botão físico como um humano faria
        console.log("🚀 Clicando no botão Registrar...");
        const btn = await page.waitForSelector('#btn-cadastrar');
        await btn.click({ delay: 200 });

        await new Promise(r => setTimeout(r, 15000));

        const urlFinal = page.url();
        const conteudo = await page.content();

        if (urlFinal.includes('/login/') || conteudo.includes("sucesso") || conteudo.includes("Até mais")) {
            pedido.mensagem = "✅ Cadastro realizado com sucesso!";
            if (browser) await browser.close();
            return true;
        }

        // Se falhar, tira um print interno (ajuda no debug do Render)
        const erroTexto = await page.evaluate(() => {
            const el = document.querySelector('.text-danger, .alert');
            return el ? el.innerText : "O Google pediu desafio de imagens.";
        });

        throw new Error(erroTexto);

    } catch (err) {
        console.error("Erro no GestorBot:", err.message);
        pedido.status = "erro";
        pedido.mensagem = `❌ ${err.message}`;
        if (browser) await browser.close();
        return false;
    }
};
