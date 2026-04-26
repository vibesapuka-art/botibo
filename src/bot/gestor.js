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
            await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
            await page.setViewport({ width: 1280, height: 800 });
            
            // Aumenta o tempo limite global para evitar o erro de Navigation Timeout
            await page.setDefaultNavigationTimeout(90000); 
        }

        pedido.mensagem = "🌐 Acessando Central ImperiumTV...";
        await page.goto("https://gestorv3.pro/imperiumtv/central/registrar/", { 
            waitUntil: "networkidle2", 
            timeout: 90000 
        });

        await page.waitForSelector('#nome', { visible: true, timeout: 60000 });

        const preencherHumano = async (seletor, valor) => {
            await page.click(seletor, { clickCount: 3 });
            await page.keyboard.press('Backspace');
            for (const char of (valor || "")) {
                await page.type(seletor, char, { delay: Math.random() * 50 + 20 });
            }
        };

        pedido.mensagem = "📝 Preenchendo dados...";
        await preencherHumano('#nome', pedido.nome);
        await preencherHumano('#sobrenome', pedido.sobrenome);
        await preencherHumano('#user', pedido.user);
        await preencherHumano('#pass', pedido.pass);
        if (pedido.whatsapp) await preencherHumano('#whatsapp', pedido.whatsapp);

        // LÓGICA DO RECAPTCHA
        pedido.mensagem = "🤖 Resolvendo verificação...";
        const frameHandle = await page.waitForSelector('iframe[src*="api2/anchor"]', { timeout: 60000 });
        const frame = await frameHandle.contentFrame();
        
        const rect = await frame.evaluate(() => {
            const el = document.querySelector('#recaptcha-anchor');
            const { x, y, width, height } = el.getBoundingClientRect();
            return { x, y, width, height };
        });

        const offsetFrame = await page.evaluate(el => {
            const { x, y } = el.getBoundingClientRect();
            return { x, y };
        }, frameHandle);

        // Clique com leve variação de posição
        const clickX = offsetFrame.x + rect.x + (rect.width / 2) + (Math.random() * 4);
        const clickY = offsetFrame.y + rect.y + (rect.height / 2) + (Math.random() * 4);

        await page.mouse.click(clickX, clickY, { delay: 150 });

        pedido.mensagem = "⏳ Aguardando validação...";
        await new Promise(r => setTimeout(r, 8000)); 

        pedido.mensagem = "🚀 Enviando cadastro...";
        // Usa Promise.all para garantir que o clique e a navegação sejam capturados juntos
        await Promise.all([
            page.click('#btn-cadastrar'),
            page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 90000 }).catch(() => null)
        ]);
        
        // Verifica se chegamos na tela de login ou se a mensagem de sucesso apareceu
        const finalUrl = page.url();
        const conteudo = await page.content();
        
        if (finalUrl.includes('/login/') || conteudo.includes("Até mais sucesso")) {
            pedido.mensagem = "✅ Cadastro realizado com sucesso!";
            if (browser) await browser.close();
            return true;
        }

        throw new Error("Não foi possível confirmar o redirecionamento.");

    } catch (err) {
        console.error("Erro no GestorBot:", err.message);
        pedido.status = "erro";
        pedido.mensagem = `❌ Erro: ${err.message.includes('timeout') ? 'Site lento ou bloqueado' : 'Falha no cadastro'}`;
        if (browser) await browser.close();
        return false;
    }
};
