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
                    "--disable-blink-features=AutomationControlled",
                ],
                executablePath: executablePath,
                headless: chromium.headless,
            });
            page = await browser.newPage();
            // User-agent atualizado para maior compatibilidade
            await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
            await page.setViewport({ width: 1280, height: 800 });
        }

        // URL ATUALIZADA: gestorv3.pro
        pedido.mensagem = "🌐 Acessando Central ImperiumTV...";
        await page.goto("https://gestorv3.pro/imperiumtv/central/registrar/", { 
            waitUntil: "networkidle2", 
            timeout: 90000 
        });

        // Aguarda carregamento de segurança
        await new Promise(r => setTimeout(r, 5000));

        pedido.mensagem = "📝 Preenchendo formulário...";
        await page.waitForSelector('#nome', { visible: true, timeout: 60000 });

        const preencher = async (seletor, valor) => {
            await page.click(seletor, { clickCount: 3 });
            await page.keyboard.press('Backspace');
            await page.type(seletor, valor || "", { delay: 100 });
        };

        await preencher('#nome', pedido.nome);
        await preencher('#sobrenome', pedido.sobrenome);
        await preencher('#user', pedido.user);
        await preencher('#pass', pedido.pass);

        if (pedido.whatsapp) {
            await preencher('#whatsapp', pedido.whatsapp);
        }

        pedido.mensagem = "🛡️ Validando segurança...";
        await new Promise(r => setTimeout(r, 8000)); 

        pedido.mensagem = "🚀 Finalizando registro...";
        await page.click('#btn-cadastrar');
        
        // Verificação inteligente de sucesso baseada na sua observação
        pedido.mensagem = "⏳ Aguardando confirmação...";
        
        try {
            // Espera o redirecionamento para a tela de login
            await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 20000 });
            
            const urlAtual = page.url();
            if (urlAtual.includes('/login/')) {
                pedido.mensagem = "✅ Cadastro realizado com sucesso!";
                if (browser) await browser.close();
                return true;
            }
        } catch (e) {
            // Backup: verifica se a mensagem de "Até mais" apareceu
            const conteudo = await page.content();
            if (conteudo.includes("Até mais sucesso")) {
                pedido.mensagem = "✅ Sucesso detectado!";
                if (browser) await browser.close();
                return true;
            }
        }

        throw new Error("Não foi possível confirmar o sucesso.");

    } catch (err) {
        console.error("Erro no GestorBot:", err.message);
        pedido.status = "erro";
        pedido.mensagem = "❌ Erro no cadastro da central.";
        if (browser) await browser.close();
        return false;
    }
};
