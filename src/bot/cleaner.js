const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

module.exports = async (pedido) => {
    let browser;
    try {
        browser = await puppeteer.launch({
            args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox"],
            executablePath: await chromium.executablePath(),
            headless: true 
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });

        // 1. LOGIN COM OS NOMES REAIS DOS CAMPOS
        pedido.mensagem = "Conectando ao painel...";
        await page.goto("https://iboproapp.com/manage-playlists/login/", { waitUntil: "networkidle2" });
        
        // Campo MAC
        await page.waitForSelector('#mac_address', { visible: true });
        await page.type('#mac_address', pedido.mac);

        // Campo Device Key (que no código é 'password')
        await page.type('#password', pedido.key);
        
        // Botão de Login
        await Promise.all([
            page.click('button[type="submit"].btn-primary'),
            page.waitForNavigation({ waitUntil: "networkidle2" })
        ]);

        // 2. LOOP DE EXCLUSÃO
        while (true) {
            await page.reload({ waitUntil: "networkidle2" });
            
            // Botão Delete Amarelo
            const deleteBtn = await page.$('button.btn-warning.styles_button__17ZvA');
            
            if (!deleteBtn) {
                console.log("Limpeza completa.");
                break; 
            }

            pedido.mensagem = "Removendo lista encontrada...";
            await deleteBtn.click();

            // 3. CONFIRMAÇÃO DO PIN
            try {
                // Campo de PIN
                await page.waitForSelector('input[name="pin"]', { visible: true, timeout: 8000 });
                await page.type('input[name="pin"]', "123321", { delay: 100 }); 

                // Botão OK Verde
                const okBtn = await page.$('button.btn-success');
                await okBtn.click();

                // Espera de 5 segundos para o servidor processar
                await new Promise(r => setTimeout(r, 5000));
            } catch (pinErr) {
                console.log("Erro no modal do PIN.");
                break;
            }
        }

        pedido.mensagem = "✅ Limpeza profunda concluída!";
        
    } catch (err) {
        console.error("Erro no Cleaner:", err.message);
        pedido.mensagem = "❌ Erro técnico na limpeza.";
    } finally {
        if (browser) await browser.close();
    }
};
