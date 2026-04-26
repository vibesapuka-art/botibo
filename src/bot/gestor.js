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
                    "--disable-blink-features=AutomationControlled", // Tenta ocultar que é um bot
                ],
                executablePath: executablePath,
                headless: chromium.headless,
            });
            page = await browser.newPage();
            
            // Define um User-Agent real para evitar bloqueios do Cloudflare
            await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
            await page.setViewport({ width: 1280, height: 800 });
        }

        pedido.mensagem = "🌐 Acessando Gestor V3...";
        
        // Tenta carregar a página com um tempo de espera maior e ignorando erros de rede leves
        await page.goto("https://gestorv3.com.br/central/registrar/", { 
            waitUntil: "networkidle2", 
            timeout: 90000 
        });

        // Aguarda um pouco antes de procurar o seletor para garantir que scripts de segurança rodem
        await new Promise(r => setTimeout(r, 5000));

        pedido.mensagem = "📝 Localizando formulário...";
        // Verifica se o seletor existe antes de tentar digitar
        await page.waitForSelector('#nome', { visible: true, timeout: 60000 });

        pedido.mensagem = "✍️ Preenchendo dados...";
        await page.type('#nome', pedido.nome || "Jefferson", { delay: 100 });
        await page.type('#sobrenome', pedido.sobrenome || "Teste", { delay: 100 });
        await page.type('#user', pedido.user, { delay: 100 });
        await page.type('#pass', pedido.pass, { delay: 100 });

        if (pedido.whatsapp) {
            await page.type('#whatsapp', pedido.whatsapp, { delay: 100 });
        }

        pedido.mensagem = "🛡️ Finalizando segurança...";
        await new Promise(r => setTimeout(r, 8000)); // Tempo extra para o Cloudflare autorizar

        pedido.mensagem = "🚀 Criando conta...";
        await page.click('#btn-cadastrar');
        
        // Espera a resposta do servidor ou redirecionamento
        await new Promise(r => setTimeout(r, 5000));

        pedido.mensagem = "✅ Cadastro enviado!";
        if (browser) await browser.close();
        return true;

    } catch (err) {
        console.error("Erro no GestorBot:", err.message);
        
        // Se falhar, tira um print do erro para diagnóstico (opcional)
        try { await page.screenshot({ path: 'erro_gestor.png' }); } catch(e) {}
        
        pedido.status = "erro";
        pedido.mensagem = "❌ Site do Gestor demorou a responder.";
        if (browser) await browser.close();
        return false;
    }
};
