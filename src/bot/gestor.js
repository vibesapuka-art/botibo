const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

module.exports = async (pedido, pageExistente = null) => {
    let browser;
    let page = pageExistente;

    try {
        const loginFinal = pedido.usuario_iptv || pedido.user || "";
        const senhaFinal = pedido.senha_iptv || pedido.pass || "";

        console.log(`[DEBUG] Iniciando Registro -> User: ${loginFinal} | Pass: ${senhaFinal}`);

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
            await page.focus(id);
            await page.click(id, { clickCount: 3 });
            await page.keyboard.press('Backspace');
            await page.keyboard.type(String(valor || ""), { delay: 100 });
        };

        pedido.mensagem = "📝 Preenchendo dados...";
        await preencher('#nome', pedido.nome);
        await preencher('#sobrenome', pedido.sobrenome);
        await preencher('#user', loginFinal);
        await preencher('#pass', senhaFinal);
        if (pedido.whatsapp) await preencher('#whatsapp', pedido.whatsapp);

        // --- CAPTCHA ---
        pedido.mensagem = "🤖 Acionando captcha...";
        const frameHandle = await page.waitForSelector('iframe[src*="api2/anchor"]');
        await frameHandle.focus();
        await page.keyboard.press('Tab');
        await new Promise(r => setTimeout(r, 1000));
        await page.keyboard.press('Space');

        pedido.mensagem = "⏳ Aguardando validação...";
        await new Promise(r => setTimeout(r, 10000)); 

        pedido.mensagem = "🚀 Clicando em Registrar...";
        await page.click('#btn-cadastrar');

        // Espera o processamento do servidor
        await new Promise(r => setTimeout(r, 10000));

        const urlFinal = page.url();
        const conteudo = await page.content();

        // 1. Verificação de Sucesso
        if (urlFinal.includes('/login/') || conteudo.includes("Até mais sucesso")) {
            pedido.mensagem = "✅ Cadastro realizado com sucesso!";
            if (browser) await browser.close();
            return true;
        }

        // 2. BUSCA DE ERROS NO SITE (O "DETETIVE")
        const erroDetectado = await page.evaluate(() => {
            // Busca mensagens de erro comuns em vermelho ou alertas
            const msgErro = document.querySelector('.text-danger, .invalid-feedback, .alert-danger, #erro-mensagem');
            if (msgErro && msgErro.innerText.trim().length > 0) {
                return msgErro.innerText.trim();
            }
            
            // Verifica se algum campo ficou com borda vermelha
            const campoInvalido = document.querySelector('.is-invalid');
            if (campoInvalido) {
                const label = document.querySelector(`label[for="${campoInvalido.id}"]`);
                return `Campo inválido: ${label ? label.innerText : campoInvalido.id}`;
            }

            return null;
        });

        if (erroDetectado) {
            throw new Error(`Site reportou: ${erroDetectado}`);
        }

        throw new Error("O site não avançou e não mostrou erro claro.");

    } catch (err) {
        console.error("Erro no GestorBot:", err.message);
        pedido.status = "erro";
        // Envia a mensagem real do site para o seu painel
        pedido.mensagem = `❌ ${err.message}`;
        if (browser) await browser.close();
        return false;
    }
};
