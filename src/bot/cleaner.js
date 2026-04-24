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
        await page.type('#password', pedido.key); // Usando 'password' conforme o código-fonte real
        
        await Promise.all([
            page.click('button[type="submit"].btn-primary'),
            page.waitForNavigation({ waitUntil: "networkidle2" })
        ]);

        // 2. CONTAGEM E LIMPEZA
        while (true) {
            await page.reload({ waitUntil: "networkidle2" });
            
            // Conta quantos botões de Delete existem na página
            const totalListas = await page.$$eval('button.btn-warning', (btns) => btns.length);
            
            if (totalListas === 0) {
                pedido.mensagem = "✅ Tudo limpo! Nenhuma lista restante.";
                break; 
            }

            // Atualiza o painel para você ver o progresso real
            pedido.mensagem = `Encontradas ${totalListas} listas. Excluindo uma...`;
            
            const deleteBtn = await page.$('button.btn-warning');
            await deleteBtn.click();

            // 3. CONFIRMAÇÃO DO PIN
            try {
                // Espera o campo de PIN e o botão OK
                await page.waitForSelector('input[name="pin"]', { visible: true, timeout: 8000 });
                await page.type('input[name="pin"]', "123321", { delay: 100 }); 

                const okBtn = await page.$('button.btn-success');
                await okBtn.click();

                // Pausa para o servidor aceitar o comando
                await new Promise(r => setTimeout(r, 5000));
                
                // Verifica se o modal sumiu, se não sumiu, tenta clicar no OK de novo
                const modalAindaAberto = await page.$('input[name="pin"]');
                if (modalAindaAberto) {
                    await page.keyboard.press('Enter');
                    await new Promise(r => setTimeout(r, 3000));
                }
            } catch (pinErr) {
                console.log("Erro ao processar o PIN.");
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
