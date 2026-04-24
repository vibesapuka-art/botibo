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
        
        // --- MESMA LÓGICA DE CONEXÃO DO ENGINE.JS ---
        pedido.mensagem = "Conectando ao painel...";
        await page.goto("https://iboproapp.com/manage-playlists/login/", { waitUntil: "networkidle2" });
        
        // Aguarda os campos aparecerem conforme o padrão que já funciona no seu bot
        await page.waitForSelector('input[name="mac_address"]');
        await page.type('input[name="mac_address"]', pedido.mac);
        await page.type('input[name="device_key"]', pedido.key);
        
        // Clique no botão de login
        await Promise.all([
            page.click('button[type="submit"]'),
            page.waitForNavigation({ waitUntil: "networkidle2" })
        ]);
        // ---------------------------------------------

        // Loop de limpeza profunda
        while (true) {
            pedido.mensagem = "Verificando listas...";
            await page.reload({ waitUntil: "networkidle2" });

            // Busca o botão de Delete vermelho
            const deleteBtn = await page.$('.btn-danger, button[onclick*="delete"]');
            
            if (!deleteBtn) {
                console.log("Limpeza finalizada: nenhuma playlist encontrada.");
                break; 
            }

            pedido.mensagem = "Removendo playlist antiga...";
            await deleteBtn.click();

            // Espera o Modal do PIN
            try {
                // Espera o campo de PIN estar visível e clica nele
                await page.waitForSelector('input#pin, input[name="pin"]', { visible: true, timeout: 8000 });
                const pinField = await page.$('input#pin, input[name="pin"]');
                
                await pinField.click({ clickCount: 3 }); // Seleciona tudo que houver no campo
                await pinField.type("123321"); // Digita o seu PIN padrão
                
                // Clica no botão verde "Ok"
                const okBtn = await page.$('button.btn-success, .btn-primary');
                if (okBtn) {
                    await okBtn.click();
                } else {
                    await page.keyboard.press('Enter');
                }

                // Pausa de 4 segundos para o servidor processar a exclusão
                await new Promise(r => setTimeout(r, 4000));
            } catch (pinErr) {
                console.log("Erro ao processar o PIN, tentando próximo ciclo.");
                break;
            }
        }

        pedido.mensagem = "✅ Limpeza concluída!";
        
    } catch (err) {
        console.error("Erro no Cleaner:", err.message);
        pedido.mensagem = "❌ Erro na conexão: " + err.message;
    } finally {
        if (browser) await browser.close();
    }
};
