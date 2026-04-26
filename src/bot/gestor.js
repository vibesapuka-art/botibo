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
        await page.waitForSelector('#nome', { visible: true });

        // Preenchimento Direto nos IDs para não errar
        const preencher = async (id, valor) => {
            await page.focus(id);
            await page.click(id, { clickCount: 3 });
            await page.keyboard.press('Backspace');
            await page.keyboard.type(String(valor || ""), { delay: 50 });
        };

        pedido.mensagem = "📝 Preenchendo dados...";
        await preencher('#nome', pedido.nome);
        await preencher('#sobrenome', pedido.sobrenome);
        await preencher('#user', pedido.user);
        await preencher('#pass', pedido.pass);
        if (pedido.whatsapp) await preencher('#whatsapp', pedido.whatsapp);

        // --- CHEGANDO NO RECAPTCHA ---
        pedido.mensagem = "🤖 Acionando verificação...";
        
        // Em vez de contar Tabs desde o começo, focamos no iframe do captcha primeiro
        await page.focus('iframe[src*="api2/anchor"]');
        
        // Agora sim, usamos o teclado dentro do contexto do captcha
        await page.keyboard.press('Tab');   // Entra no checkbox
        await new Promise(r => setTimeout(r, 500));
        await page.keyboard.press('Space'); // Marca "Não sou um robô"

        pedido.mensagem = "⏳ Validando captcha (8s)...";
        await new Promise(r => setTimeout(r, 8000)); 

        // Navega até o botão de Registrar
        // Após o captcha, geralmente 1 ou 2 Tabs chegam no botão final
        await page.keyboard.press('Tab'); 
        await page.keyboard.press('Enter');

        pedido.mensagem = "🚀 Finalizando registro...";
        await new Promise(r => setTimeout(r, 12000));

        const urlFinal = page.url();
        const conteudo = await page.content();

        if (urlFinal.includes('/login/') || conteudo.includes("Até mais sucesso")) {
            pedido.mensagem = "✅ Cadastro realizado com sucesso!";
            if (browser) await browser.close();
            return true;
        }

        // Diagnóstico se não mudou de página
        if (conteudo.includes("usuário já cadastrado")) throw new Error("Usuário já existe.");
        
        throw new Error("O site não avançou. O captcha pode ter pedido imagens.");

    } catch (err) {
        console.error("Erro no GestorBot:", err.message);
        pedido.status = "erro";
        pedido.mensagem = `❌ ${err.message}`;
        if (browser) await browser.close();
        return false;
    }
};
