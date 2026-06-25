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
                args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox"],
                executablePath: executablePath,
                headless: chromium.headless,
            });
            page = await browser.newPage();

            // --- CONFIGURAÇÃO MOBILE ---
            // Definimos o tamanho da tela como se fosse um celular (iPhone 13)
            await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
            
            // User Agent de um iPhone para o Google não pedir as fotos
            await page.setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1");
        }

        await page.goto("https://gestorv3.pro/imperiumtv/central/registrar/", { waitUntil: "networkidle2" });
        await page.waitForSelector('#nome');

        // Preenchimento simulando toque na tela
        const preencherMobile = async (id, valor) => {
            await page.tap(id); // Usa o comando TAP (toque) em vez de click
            await new Promise(r => setTimeout(r, 500));
            await page.keyboard.type(String(valor || ""), { delay: 100 });
        };

        pedido.mensagem = "📝 Preenchendo via Mobile...";
        await preencherMobile('#nome', pedido.nome);
        await preencherMobile('#sobrenome', pedido.sobrenome);
        await preencherMobile('#user', loginFinal);
        await preencherMobile('#pass', senhaFinal);
        if (pedido.whatsapp) await preencherMobile('#whatsapp', pedido.whatsapp);

        // --- RECAPTCHA NO MODO MOBILE ---
        console.log("🤖 Acionando Captcha (Modo Mobile)...");
        const frameHandle = await page.waitForSelector('iframe[src*="api2/anchor"]');
        const frame = await frameHandle.contentFrame();
        
        // No celular, o toque no checkbox costuma validar direto
        await frame.tap('#recaptcha-anchor');

        await new Promise(r => setTimeout(r, 12000)); 

        console.log("🚀 Clicando em Registrar...");
        await page.tap('#btn-cadastrar');

        await new Promise(r => setTimeout(r, 15000));

        const urlFinal = page.url();
        const conteudo = await page.content();

        if (urlFinal.includes('/login/') || conteudo.includes("sucesso") || conteudo.includes("Até mais")) {
            pedido.mensagem = "✅ Cadastro realizado com sucesso!";
            if (browser) await browser.close();
            return true;
        }

        const erroTexto = await page.evaluate(() => {
            const el = document.querySelector('.text-danger, .alert');
            return el ? el.innerText : "O Google ainda desconfiou e pediu imagens.";
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
