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

        // NOVA URL FORNECIDA
        pedido.mensagem = "🌐 Acessando Central ImperiumTV...";
        await page.goto("https://gprofaturas.com.br/imperiumtv/central/registrar/", { 
            waitUntil: "networkidle2", 
            timeout: 90000 
        });

        // Espera o carregamento inicial e scripts de proteção
        await new Promise(r => setTimeout(r, 5000));

        pedido.mensagem = "📝 Preenchendo formulário...";
        await page.waitForSelector('#nome', { visible: true, timeout: 60000 });

        // Função auxiliar para limpar e digitar com calma
        const preencher = async (seletor, valor) => {
            await page.click(seletor, { clickCount: 3 }); // Seleciona tudo que houver no campo
            await page.keyboard.press('Backspace');       // Apaga
            await page.type(seletor, valor || "", { delay: 100 });
        };

        await preencher('#nome', pedido.nome);
        await preencher('#sobrenome', pedido.sobrenome);
        await preencher('#user', pedido.user);
        await preencher('#pass', pedido.pass);

        if (pedido.whatsapp) {
            await preencher('#whatsapp', pedido.whatsapp);
        }

        // Tempo para o Cloudflare validar o comportamento humano
        pedido.mensagem = "🛡️ Aguardando validação...";
        await new Promise(r => setTimeout(r, 8000)); 

        pedido.mensagem = "🚀 Finalizando registro...";
        await page.click('#btn-cadastrar');
        
        // Aguarda a resposta do sistema
        await new Promise(r => setTimeout(r, 5000));

        pedido.mensagem = "✅ Cadastro enviado com sucesso!";
        if (browser) await browser.close();
        return true;

    } catch (err) {
        console.error("Erro no GestorBot:", err.message);
        pedido.status = "erro";
        pedido.mensagem = "❌ Falha ao acessar a central de faturas.";
        if (browser) await browser.close();
        return false;
    }
};
