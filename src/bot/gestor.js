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
                args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox", "--disable-blink-features=AutomationControlled"],
                executablePath: executablePath,
                headless: chromium.headless,
            });
            page = await browser.newPage();
            // User agent mais comum para evitar detecção de bot
            await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
        }

        await page.goto("https://gestorv3.pro/imperiumtv/central/registrar/", { waitUntil: "networkidle2" });
        await page.waitForSelector('#nome');

        // Preenchimento com cliques reais antes de digitar
        const preencherHibrido = async (id, valor) => {
            await page.click(id); // Clique real para focar
            await page.click(id, { clickCount: 3 });
            await page.keyboard.press('Backspace');
            await page.keyboard.type(String(valor || ""), { delay: 50 });
        };

        await preencherHibrido('#nome', pedido.nome);
        await preencherHibrido('#sobrenome', pedido.sobrenome);
        await preencherHibrido('#user', loginFinal);
        await preencherHibrido('#pass', senhaFinal);
        if (pedido.whatsapp) await preencherHibrido('#whatsapp', pedido.whatsapp);

        // --- MANIPULAÇÃO DO RECAPTCHA ---
        console.log("🤖 Tentando marcar o captcha...");
        const frame = page.frames().find(f => f.url().includes('api2/anchor'));
        if (frame) {
            const checkbox = await frame.waitForSelector('#recaptcha-anchor');
            await checkbox.click({ delay: 200 });
        }

        // Espera generosa para validação do Google
        await new Promise(r => setTimeout(r, 15000)); 

        // --- O PULO DO GATO: FORÇAR O ENVIO ---
        console.log("🚀 Forçando submissão do formulário...");
        await page.evaluate(() => {
            const form = document.querySelector('form');
            if (form) form.submit(); // Tenta enviar o formulário diretamente
            else document.querySelector('#btn-cadastrar').click(); // Se não tiver form, clica no botão
        });

        await new Promise(r => setTimeout(r, 15000));

        const urlFinal = page.url();
        const conteudo = await page.content();

        if (urlFinal.includes('/login/') || conteudo.includes("sucesso") || conteudo.includes("Até mais")) {
            pedido.mensagem = "✅ Cadastro realizado com sucesso!";
            if (browser) await browser.close();
            return true;
        }

        // Se ainda assim não foi, pegamos o erro final
        const erroFinal = await page.evaluate(() => {
            const el = document.querySelector('.text-danger, .alert');
            return el ? el.innerText : "Captcha bloqueou ou campo invisível barrou.";
        });

        throw new Error(erroFinal);

    } catch (err) {
        console.error("Erro no GestorBot:", err.message);
        pedido.status = "erro";
        pedido.mensagem = `❌ ${err.message}`;
        if (browser) await browser.close();
        return false;
    }
};
