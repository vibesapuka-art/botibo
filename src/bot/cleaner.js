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
        await page.waitForSelector('#mac_address');
        await page.type('#mac_address', pedido.mac);
        await page.type('#password', pedido.key);
        await Promise.all([
            page.click('button[type="submit"]'),
            page.waitForNavigation({ waitUntil: "networkidle2" })
        ]);

        // 2. CONTAGEM E LIMPEZA
        while (true) {
            await page.reload({ waitUntil: "networkidle2" });
            
            // Localiza todos os botões de Delete amarelo
            const totalListas = await page.$$eval('button.btn-warning', btns => btns.length);
            
            if (totalListas === 0) {
                pedido.mensagem = "✅ Tudo limpo! Aparelho liberado.";
                break; 
            }

            pedido.mensagem = `Encontradas ${totalListas} listas. Excluindo...`;

            // CLIQUE FORÇADO: Usa JavaScript para clicar no primeiro botão Delete encontrado
            await page.evaluate(() => {
                const btn = document.querySelector('button.btn-warning');
                if (btn) btn.click();
            });

            // 3. CONFIRMAÇÃO DO PIN
            try {
                // Espera o modal de PIN ficar 100% visível
                await page.waitForSelector('input[name="pin"]', { visible: true, timeout: 10000 });
                
                // Digita o PIN simulando teclado real
                await page.focus('input[name="pin"]');
                await page.keyboard.type("123321", { delay: 150 }); 

                // Clique forçado no botão OK (verde)
                await page.evaluate(() => {
                    const okBtn = document.querySelector('button.btn-success');
                    if (okBtn) okBtn.click();
                });

                // Espera 5 segundos para o site processar a exclusão antes de recarregar
                await new Promise(r => setTimeout(r, 5000));
                
            } catch (pinErr) {
                console.log("Erro ao processar o PIN ou modal não abriu.");
                // Se o modal não abriu, tenta dar um Enter caso o clique tenha falhado
                await page.keyboard.press('Enter');
                await new Promise(r => setTimeout(r, 3000));
            }
        }
        
    } catch (err) {
        console.error("Erro no Cleaner:", err.message);
        pedido.mensagem = "❌ Erro: " + err.message;
    } finally {
        if (browser) await browser.close();
    }
};
