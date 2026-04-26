const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

module.exports = async (pedido, pageExistente = null) => {
    let browser;
    let page = pageExistente;

    try {
        // MAPEAMENTO DAS VARIÁVEIS
        // Pegamos usuario_iptv ou user, e senha_iptv ou pass
        const loginFinal = pedido.usuario_iptv || pedido.user || "";
        const senhaFinal = pedido.senha_iptv || pedido.pass || "";

        console.log(`[DEBUG] Enviando para Gestor -> User: ${loginFinal} | Pass: ${senhaFinal}`);

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

        const preencher = async (id, valor) => {
            if (!valor) return; // Evita erro se o valor for nulo
            await page.focus(id);
            await page.click(id, { clickCount: 3 });
            await page.keyboard.press('Backspace');
            await page.keyboard.type(String(valor), { delay: 100 });
        };

        pedido.mensagem = "📝 Preenchendo cadastro...";
        await preencher('#nome', pedido.nome);
        await preencher('#sobrenome', pedido.sobrenome);
        
        // PREENCHIMENTO DOS CAMPOS DE ACESSO
        await preencher('#user', loginFinal);
        await preencher('#pass', senhaFinal);
        
        if (pedido.whatsapp) await preencher('#whatsapp', pedido.whatsapp);

        pedido.mensagem = "🤖 Acionando captcha...";
        const frameHandle = await page.waitForSelector('iframe[src*="api2/anchor"]');
        await frameHandle.focus();
        
        await page.keyboard.press('Tab');
        await new Promise(r => setTimeout(r, 1000));
        await page.keyboard.press('Space');

        pedido.mensagem = "⏳ Validando...";
        await new Promise(r => setTimeout(r, 10000)); 

        pedido.mensagem = "🚀 Clicando em Registrar...";
        await page.click('#btn-cadastrar');

        await new Promise(r => setTimeout(r, 12000));

        const urlFinal = page.url();
        const conteudo = await page.content();

        if (urlFinal.includes('/login/') || conteudo.includes("Até mais sucesso")) {
            pedido.mensagem = "✅ Cadastro realizado com sucesso!";
            if (browser) await browser.close();
            return true;
        }

        if (conteudo.includes("usuário já cadastrado")) throw new Error("Usuário já existe.");
        
        throw new Error("O site não avançou após o registro.");

    } catch (err) {
        console.error("Erro no GestorBot:", err.message);
        pedido.status = "erro";
        pedido.mensagem = `❌ ${err.message}`;
        if (browser) await browser.close();
        return false;
    }
};
