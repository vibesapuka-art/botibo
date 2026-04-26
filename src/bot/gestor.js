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

        pedido.mensagem = "🌐 Abrindo Central ImperiumTV...";
        await page.goto("https://gestorv3.pro/imperiumtv/central/registrar/", { waitUntil: "networkidle2" });
        
        // Espera o campo de nome estar pronto
        await page.waitForSelector('#nome', { visible: true, timeout: 60000 });

        // Foca no primeiro campo para começar a sequência de TABs
        await page.focus('#nome');

        pedido.mensagem = "📝 Preenchendo via teclado...";
        
        // Nome -> TAB -> Sobrenome
        await page.keyboard.type(pedido.nome || "", { delay: 100 });
        await page.keyboard.press('Tab');
        await page.keyboard.type(pedido.sobrenome || "", { delay: 100 });
        await page.keyboard.press('Tab');

        // Usuário -> TAB -> Senha
        await page.keyboard.type(pedido.user || "", { delay: 100 });
        await page.keyboard.press('Tab');
        await page.keyboard.type(pedido.pass || "", { delay: 100 });
        await page.keyboard.press('Tab');

        // Pula Data de Nascimento (TAB) -> Cód País (TAB) -> WhatsApp
        await page.keyboard.press('Tab'); 
        await page.keyboard.press('Tab'); 
        await page.keyboard.type(pedido.whatsapp || "", { delay: 100 });

        // --- NAVEGANDO ATÉ O RECAPTCHA ---
        pedido.mensagem = "🤖 Selecionando captcha...";
        
        // Pressionamos TAB até chegar no checkbox do robô
        // Geralmente são 1 ou 2 TABs após o campo de telefone
        await page.keyboard.press('Tab');
        await new Promise(r => setTimeout(r, 1000));
        await page.keyboard.press('Space'); // O Espaço marca o checkbox do Google

        pedido.mensagem = "⏳ Validando...";
        await new Promise(r => setTimeout(r, 8000)); 

        // TAB final para chegar no botão "Criar Conta" e Enter para enviar
        await page.keyboard.press('Tab');
        await page.keyboard.press('Enter');

        pedido.mensagem = "🚀 Processando registro...";
        await new Promise(r => setTimeout(r, 12000));

        const urlFinal = page.url();
        const conteudo = await page.content();

        // Verificação de sucesso
        if (urlFinal.includes('/login/') || conteudo.includes("Até mais sucesso")) {
            pedido.mensagem = "✅ Cadastro realizado com sucesso!";
            if (browser) await browser.close();
            return true;
        }

        // Se o site não avançou, verificamos se há erro visível
        if (conteudo.includes("usuário já cadastrado")) throw new Error("Usuário já existe.");
        
        throw new Error("O site não avançou. Verifique se o captcha abriu imagens.");

    } catch (err) {
        console.error("Erro no GestorBot:", err.message);
        pedido.status = "erro";
        pedido.mensagem = `❌ ${err.message}`;
        if (browser) await browser.close();
        return false;
    }
};
