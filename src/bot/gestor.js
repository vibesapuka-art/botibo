const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

module.exports = async (pedido) => {
    let browser;
    try {
        browser = await puppeteer.launch({
            args: [
                ...chromium.args, 
                "--no-sandbox", 
                "--disable-setuid-sandbox",
                "--disable-blink-features=AutomationControlled" // Ajuda a evitar detecção de bot
            ],
            executable_path: await chromium.executablePath(),
            headless: true 
        });

        const page = await browser.newPage();
        
        // Define um User-Agent real para evitar bloqueios
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        await page.setViewport({ width: 1280, height: 800 });

        // 1. Acessa o link de registro enviado
        await page.goto("https://gestorv3.pro/imperiumtv/central/registrar/", { 
            waitUntil: "networkidle2",
            timeout: 60000 
        });

        // 2. Preenche os campos
        await page.waitForSelector('#nome');
        await page.type('#nome', pedido.nome, { delay: 100 });
        await page.type('#sobrenome', pedido.sobrenome, { delay: 100 });
        await page.type('#user', pedido.user, { delay: 100 }); // Usuário do formulário HTML
        await page.type('#pass', pedido.pass, { delay: 100 }); // Senha do formulário HTML
        await page.type('#whatsapp', pedido.whatsapp, { delay: 100 });

        // 3. Lógica para o reCAPTCHA (Clica no Checkbox)
        try {
            const frameHandle = await page.waitForSelector('iframe[title="reCAPTCHA"]', { timeout: 10000 });
            const frame = await frameHandle.contentFrame();
            if (frame) {
                const checkbox = await frame.$('#recaptcha-anchor');
                await checkbox.click();
                // Aguarda o Google validar o clique
                await new Promise(r => setTimeout(r, 3000));
            }
        } catch (e) {
            console.log("Aviso: reCAPTCHA não encontrado ou ignorado.");
        }

        // 4. Finaliza o Cadastro
        await page.waitForSelector('#btn-cadastrar');
        
        // Tenta o clique e pressiona Enter por segurança
        await page.click('#btn-cadastrar');
        await page.keyboard.press('Enter');

        // Espera 5 segundos para garantir que o site processe o registro
        await new Promise(r => setTimeout(r, 5000));

        console.log(`✅ Cadastro finalizado para: ${pedido.nome}`);

    } catch (err) {
        console.error("❌ Erro no Bot Gestor:", err.message);
        throw err; 
    } finally {
        if (browser) await browser.close();
    }
};
