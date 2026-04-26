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
        }

        pedido.mensagem = "🌐 Acessando Central ImperiumTV...";
        await page.goto("https://gestorv3.pro/imperiumtv/central/registrar/", { 
            waitUntil: "networkidle2", 
            timeout: 90000 
        });

        await page.waitForSelector('#nome', { visible: true, timeout: 60000 });

        // Função para simular digitação humana com atrasos variáveis
        const preencherHumano = async (seletor, valor) => {
            await page.click(seletor, { clickCount: 3 });
            await page.keyboard.press('Backspace');
            for (const char of valor) {
                await page.type(seletor, char, { delay: Math.random() * 100 + 50 });
            }
        };

        await preencherHumano('#nome', pedido.nome);
        await preencherHumano('#sobrenome', pedido.sobrenome);
        await preencherHumano('#user', pedido.user);
        await preencherHumano('#pass', pedido.pass);
        if (pedido.whatsapp) await preencherHumano('#whatsapp', pedido.whatsapp);

        // --- LÓGICA DO RECAPTCHA ---
        pedido.mensagem = "🤖 Validando verificação humana...";
        
        const frameHandle = await page.waitForSelector('iframe[src*="api2/anchor"]');
        const frame = await frameHandle.contentFrame();
        const checkbox = await frame.waitForSelector('#recaptcha-anchor');

        // Obtém as coordenadas do checkbox
        const rect = await frame.evaluate(() => {
            const el = document.querySelector('#recaptcha-anchor');
            const { x, y, width, height } = el.getBoundingClientRect();
            return { x, y, width, height };
        });

        // Calcula um ponto aleatório dentro do quadrado do checkbox para não clicar sempre no centro
        const offsetFrame = await page.evaluate(el => {
            const { x, y } = el.getBoundingClientRect();
            return { x, y };
        }, frameHandle);

        const clickX = offsetFrame.x + rect.x + (Math.random() * rect.width);
        const clickY = offsetFrame.y + rect.y + (Math.random() * rect.height);

        // Simula movimento do mouse até o local antes de clicar
        await page.mouse.move(clickX - 50, clickY - 50, { steps: 10 });
        await page.mouse.click(clickX, clickY, { delay: Math.random() * 200 + 100 });

        pedido.mensagem = "⏳ Aguardando aprovação do Google...";
        await new Promise(r => setTimeout(r, 7000)); 

        pedido.mensagem = "🚀 Finalizando registro...";
        await page.click('#btn-cadastrar');
        
        // Verificação de sucesso baseada na sua tela anterior
        await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 });
        
        if (page.url().includes('/login/') || (await page.content()).includes("Até mais sucesso")) {
            pedido.mensagem = "✅ Cadastro realizado com sucesso!";
            if (browser) await browser.close();
            return true;
        }

        throw new Error("Falha ao confirmar o cadastro.");

    } catch (err) {
        console.error("Erro no GestorBot:", err.message);
        pedido.status = "erro";
        pedido.mensagem = "❌ Erro: Verificação de robô falhou.";
        if (browser) await browser.close();
        return false;
    }
};
