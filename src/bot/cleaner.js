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
        await page.setViewport({ width: 1280, height: 800 }); // Força modo desktop para seletores estáveis

        // 1. LOGIN
        pedido.mensagem = "Entrando no painel...";
        await page.goto("https://iboproapp.com/manage-playlists/login/", { waitUntil: "networkidle2" });
        
        await page.waitForSelector('input[name="mac_address"]', { timeout: 20000 });
        await page.type('input[name="mac_address"]', pedido.mac);
        await page.type('input[name="device_key"]', pedido.key);
        
        await Promise.all([
            page.click('button[type="submit"]'),
            page.waitForNavigation({ waitUntil: "networkidle2" })
        ]);

        // 2. LOOP COM VALIDAÇÃO DE EXCLUSÃO
        let tentativas = 0;
        while (tentativas < 10) { 
            await page.reload({ waitUntil: "networkidle2" });
            
            // Verifica se o botão Delete existe
            const deleteBtn = await page.$('.btn-warning, .btn-danger, button[onclick*="delete"]');
            
            if (!deleteBtn) {
                console.log("Nenhuma playlist detectada.");
                break; 
            }

            pedido.mensagem = `Excluindo lista... (Tentativa ${tentativas + 1})`;
            
            // Rola até o botão e clica
            await deleteBtn.evaluate(el => el.scrollIntoView());
            await deleteBtn.click();

            // 3. INTERAÇÃO COM PIN
            try {
                // Espera o modal de PIN aparecer e ficar visível
                await page.waitForSelector('.modal-content, #confirmPin', { visible: true, timeout: 10000 });
                
                // Força o foco no campo de PIN e digita
                const inputPin = await page.$('input#pin, input[name="pin"], .modal-body input');
                await inputPin.focus();
                await inputPin.click({ clickCount: 3 });
                await page.keyboard.type("123321", { delay: 100 }); 

                // Clica no botão "Ok" verde
                const okBtn = await page.waitForSelector('button.btn-success, .btn-primary, #ok_btn', { visible: true });
                await okBtn.click();

                // ESPERA OBRIGATÓRIA PARA PROCESSAMENTO DO SERVIDOR
                await new Promise(r => setTimeout(r, 5000)); 
                
            } catch (pinErr) {
                console.log("Erro no modal do PIN, tentando novamente.");
            }
            
            tentativas++;
        }

        // Validação final: se ainda houver botão delete, algo deu errado
        const conferênciaFinal = await page.$('.btn-warning, .btn-danger');
        if (conferênciaFinal) {
            pedido.mensagem = "❌ O site não confirmou a exclusão. Tente novamente.";
        } else {
            pedido.mensagem = "✅ Tudo limpo! Aparelho pronto.";
        }
        
    } catch (err) {
        console.error("Erro Cleaner:", err.message);
        pedido.mensagem = "❌ Erro: " + err.message;
    } finally {
        if (browser) await browser.close();
    }
};
