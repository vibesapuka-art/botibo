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

        // 1. LOGIN
        pedido.mensagem = "Conectando ao painel...";
        await page.goto("https://iboproapp.com/manage-playlists/login/", { waitUntil: "networkidle2" });
        
        await page.waitForSelector('#mac_address', { visible: true });
        await page.type('#mac_address', pedido.mac);
        // O campo da key usa id="password" no sistema deles
        await page.type('#password', pedido.key); 
        
        await Promise.all([
            page.click('button[type="submit"].btn-primary'),
            page.waitForNavigation({ waitUntil: "networkidle2" })
        ]);

        // 2. CONTAGEM E LIMPEZA
        while (true) {
            await page.reload({ waitUntil: "networkidle2" });
            
            // Localiza todos os botões que possuem a classe de delete
            const deleteButtons = await page.$$('button.btn-warning, button.styles_button__17ZvA');
            const totalListas = deleteButtons.length;
            
            if (totalListas === 0) {
                pedido.mensagem = "✅ Tudo limpo! Nenhuma lista restante.";
                break; 
            }

            pedido.mensagem = `Encontradas ${totalListas} listas. Excluindo uma...`;
            
            // Clica no primeiro botão de delete encontrado
            await deleteButtons[0].click();

            // 3. CONFIRMAÇÃO DO PIN
            try {
                // Aguarda o campo de PIN ficar visível no modal
                await page.waitForSelector('input[name="pin"]', { visible: true, timeout: 10000 });
                await page.focus('input[name="pin"]');
                await page.keyboard.type("123321", { delay: 100 }); 

                // Localiza o botão 'Ok' verde para confirmar a exclusão
                const okBtn = await page.waitForSelector('button.btn-success', { visible: true });
                await okBtn.click();

                // Espera técnica para o servidor processar a remoção
                await new Promise(r => setTimeout(r, 5000));
                
                // Se o modal ainda estiver aberto, tenta forçar com a tecla Enter
                const modalAberto = await page.$('input[name="pin"]');
                if (modalAberto) {
                    await page.keyboard.press('Enter');
                    await new Promise(r => setTimeout(r, 3000));
                }
            } catch (pinErr) {
                console.log("Erro ao processar o PIN ou modal não apareceu.");
                break;
            }
        }
        
    } catch (err) {
        console.error("Erro no Cleaner:", err.message);
        pedido.mensagem = "❌ Erro no processo: " + err.message;
    } finally {
        if (browser) await browser.close();
    }
};
