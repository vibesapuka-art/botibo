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
        await page.setDefaultNavigationTimeout(60000);

        // 1. CONEXÃO AO PAINEL (Ajustada para evitar erro de seletor)
        pedido.mensagem = "Abrindo painel de login...";
        await page.goto("https://iboproapp.com/manage-playlists/login/", { waitUntil: "networkidle2" });
        
        // Espera qualquer um dos possíveis seletores de MAC aparecer
        await page.waitForSelector('input[name="mac_address"], #mac_address', { visible: true, timeout: 20000 });
        
        // Digita o MAC
        await page.type('input[name="mac_address"], #mac_address', pedido.mac);

        // Espera e digita a KEY usando múltiplos seletores para evitar o erro anterior
        const keySelector = 'input[name="device_key"], #device_key, input[placeholder*="Key"]';
        await page.waitForSelector(keySelector, { visible: true, timeout: 10000 });
        await page.type(keySelector, pedido.key);
        
        // Clique no botão de login (Submit)
        await Promise.all([
            page.click('button[type="submit"], .btn-primary'),
            page.waitForNavigation({ waitUntil: "networkidle2" })
        ]);

        // 2. LOOP DE LIMPEZA
        while (true) {
            await page.reload({ waitUntil: "networkidle2" });
            
            // Busca o botão de Delete (Amarelo/Vermelho na tabela)
            const deleteBtn = await page.$('.btn-warning, .btn-danger, button[onclick*="delete"]');
            
            if (!deleteBtn) {
                console.log("Limpeza concluída: sem mais listas.");
                break; 
            }

            pedido.mensagem = "Playlist encontrada. Removendo...";
            await deleteBtn.click();

            // 3. CONFIRMAÇÃO COM PIN
            try {
                // Espera o campo de PIN no modal
                await page.waitForSelector('input#pin, input[name="pin"], .modal-body input', { visible: true, timeout: 8000 });
                const pinField = await page.$('input#pin, input[name="pin"], .modal-body input');
                
                await pinField.click({ clickCount: 3 }); 
                await pinField.type("123321"); // Seu PIN padrão
                
                // Clica no botão OK (Verde) do modal
                const okBtn = await page.$('button.btn-success, .btn-primary');
                if (okBtn) await okBtn.click();
                else await page.keyboard.press('Enter');

                // Pausa de 4 segundos para o processamento do servidor
                await new Promise(r => setTimeout(r, 4000));
            } catch (pinErr) {
                console.log("Erro no PIN, tentando recarregar.");
                break;
            }
        }

        pedido.mensagem = "✅ Dispositivo limpo!";
        
    } catch (err) {
        console.error("Erro no Cleaner:", err.message);
        pedido.mensagem = "❌ Erro: Verifique se o MAC/Key estão corretos na TV.";
    } finally {
        if (browser) await browser.close();
    }
};
