const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

module.exports = async (pedido, pageExistente = null) => {
    let browser;
    let page = pageExistente;

    try {
        if (!page) {
            const executablePath = await chromium.executablePath();
            browser = await puppeteer.launch({
                args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox", "--disable-blink-features=AutomationControlled"],
                executablePath: executablePath,
                headless: chromium.headless,
            });
            page = await browser.newPage();
            await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
            await page.setDefaultNavigationTimeout(90000); 
        }

        await page.goto("https://gestorv3.pro/imperiumtv/central/registrar/", { waitUntil: "networkidle2" });
        await page.waitForSelector('#nome', { visible: true, timeout: 60000 });

        // Preenchimento com atraso humano
        const digitar = async (sel, val) => {
            await page.click(sel, { clickCount: 3 });
            await page.keyboard.press('Backspace');
            await page.type(sel, val || "", { delay: 100 });
        };

        pedido.mensagem = "📝 Preenchendo dados...";
        await digitar('#nome', pedido.nome);
        await digitar('#sobrenome', pedido.sobrenome);
        await digitar('#user', pedido.user);
        await digitar('#pass', pedido.pass);
        if (pedido.whatsapp) await digitar('#whatsapp', pedido.whatsapp);

        // --- CLIQUE NO RECAPTCHA ---
        pedido.mensagem = "🤖 Validando captcha...";
        const frameHandle = await page.waitForSelector('iframe[src*="api2/anchor"]');
        const frame = await frameHandle.contentFrame();
        const rect = await frame.evaluate(() => document.querySelector('#recaptcha-anchor').getBoundingClientRect());
        const offset = await page.evaluate(el => el.getBoundingClientRect(), frameHandle);

        await page.mouse.click(offset.x + rect.x + rect.width / 2, offset.y + rect.y + rect.height / 2);
        await new Promise(r => setTimeout(r, 8000)); // Espera validação

        pedido.mensagem = "🚀 Clicando em Registrar...";
        await page.click('#btn-cadastrar');

        // Aguarda um pouco para ver se redireciona ou se aparece erro na tela
        await new Promise(r => setTimeout(r, 10000));

        const urlFinal = page.url();
        const conteudo = await page.content();

        // 1. Verifica Sucesso por URL ou Mensagem
        if (urlFinal.includes('/login/') || conteudo.includes("Até mais sucesso")) {
            pedido.mensagem = "✅ Cadastro realizado com sucesso!";
            if (browser) await browser.close();
            return true;
        }

        // 2. Diagnóstico de Erro (Verifica o que o site respondeu)
        if (conteudo.includes("usuário já cadastrado") || conteudo.includes("já existe")) {
            throw new Error("Este usuário já existe no sistema.");
        } else if (conteudo.includes("solicitação de captcha inválida")) {
            throw new Error("O Google bloqueou o captcha.");
        } else {
            // Tira print para você ver o que o bot está vendo
            await page.screenshot({ path: 'erro_registro.png' });
            throw new Error("O site não avançou após o clique.");
        }

    } catch (err) {
        console.error("Erro no GestorBot:", err.message);
        pedido.status = "erro";
        pedido.mensagem = `❌ ${err.message}`;
        if (browser) await browser.close();
        return false;
    }
};
