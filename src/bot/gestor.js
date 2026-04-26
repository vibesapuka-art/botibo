const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

module.exports = async (pedido, pageExistente = null) => {
    let browser;
    let page = pageExistente;

    try {
        if (!page) {
            const executablePath = await chromium.executablePath();
            browser = await puppeteer.launch({
                args: [
                    ...chromium.args, 
                    "--no-sandbox", 
                    "--disable-setuid-sandbox", 
                    "--disable-blink-features=AutomationControlled"
                ],
                executablePath: executablePath,
                headless: chromium.headless,
            });
            page = await browser.newPage();
            await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
            await page.setDefaultNavigationTimeout(90000); 
        }

        pedido.mensagem = "🌐 Abrindo Central ImperiumTV...";
        await page.goto("https://gestorv3.pro/imperiumtv/central/registrar/", { waitUntil: "networkidle2" });
        await page.waitForSelector('#nome', { visible: true, timeout: 60000 });

        const digitar = async (sel, val) => {
            await page.click(sel, { clickCount: 3 });
            await page.keyboard.press('Backspace');
            await page.type(sel, String(val || ""), { delay: 100 });
        };

        pedido.mensagem = "📝 Preenchendo formulário...";
        await digitar('#nome', pedido.nome);
        await digitar('#sobrenome', pedido.sobrenome);
        await digitar('#user', pedido.user);
        await digitar('#pass', pedido.pass);
        if (pedido.whatsapp) await digitar('#whatsapp', pedido.whatsapp);

        // --- CORREÇÃO DO CLIQUE NO RECAPTCHA ---
        pedido.mensagem = "🤖 Validando captcha...";
        const frameHandle = await page.waitForSelector('iframe[src*="api2/anchor"]');
        
        // Nova forma mais segura de clicar sem erro de parâmetros inválidos
        const boundingBox = await frameHandle.boundingBox();
        if (boundingBox) {
            // Clica exatamente no centro do iframe onde o checkbox fica localizado
            await page.mouse.click(
                boundingBox.x + (boundingBox.width / 2) - 100, 
                boundingBox.y + (boundingBox.height / 2), 
                { delay: 150 }
            );
        } else {
            // Fallback caso o boundingBox falhe
            await frameHandle.click();
        }

        await new Promise(r => setTimeout(r, 8000)); 

        pedido.mensagem = "🚀 Registrando conta...";
        await page.click('#btn-cadastrar');

        // Aguarda resposta ou redirecionamento
        await new Promise(r => setTimeout(r, 12000));

        const urlFinal = page.url();
        const conteudo = await page.content();

        if (urlFinal.includes('/login/') || conteudo.includes("Até mais sucesso")) {
            pedido.mensagem = "✅ Cadastro realizado com sucesso!";
            if (browser) await browser.close();
            return true;
        }

        // Diagnóstico de erros comuns
        if (conteudo.includes("usuário já cadastrado")) throw new Error("Usuário já existe.");
        if (conteudo.includes("captcha inválida")) throw new Error("Google barrou o bot.");

        throw new Error("O site não avançou após o registro.");

    } catch (err) {
        console.error("Erro no GestorBot:", err.message);
        pedido.status = "erro";
        pedido.mensagem = `❌ ${err.message}`;
        if (browser) await browser.close();
        return false;
    }
};
