const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

module.exports = async (pedido) => {
    let browser;
    try {
        browser = await puppeteer.launch({
            args: [...chromium.args, "--no-sandbox"],
            executablePath: await chromium.executablePath(),
            headless: true
        });

        const page = await browser.newPage();
        await page.setDefaultNavigationTimeout(60000);

        // 1. LOGIN OBRIGATÓRIO
        pedido.mensagem = "Autenticando no painel...";
        await page.goto("https://iboproapp.com/manage-playlists/login/", { waitUntil: "networkidle2" });
        
        await page.waitForSelector('input[name="mac_address"]', { timeout: 15000 });
        await page.type('input[name="mac_address"]', pedido.mac);
        await page.type('input[name="device_key"]', pedido.key);
        
        await Promise.all([
            page.click('button[type="submit"]'),
            page.waitForNavigation({ waitUntil: "networkidle2" })
        ]);

        // 2. VERIFICAÇÃO DE SESSÃO
        // Após o login, o site deve carregar a lista automaticamente
        const URL_LISTA = "https://iboproapp.com/manage-playlists/list/";
        if (page.url() !== URL_LISTA) {
            await page.goto(URL_LISTA, { waitUntil: "networkidle2" });
        }

        // 3. LOOP DE LIMPEZA
        while (true) {
            // Garante que a página está atualizada para ler os botões "Delete"
            await page.reload({ waitUntil: "networkidle2" });
            
            // Procura o botão Delete usando múltiplos critérios (classe e texto)
            const deleteBtn = await page.$('.btn-danger, .btn-delete, button[onclick*="delete"]');

            if (!deleteBtn) {
                console.log("Nenhuma playlist encontrada.");
                break; 
            }

            pedido.mensagem = "Playlist encontrada! Excluindo...";
            await deleteBtn.click();

            // 4. TRATAMENTO DO MODAL DE PIN
            try {
                // Espera o campo de PIN aparecer no modal
                await page.waitForSelector('input#pin, input[name="pin"], .modal-body input', { visible: true, timeout: 10000 });
                
                // Clica, limpa e digita o PIN
                const inputPin = await page.$('input#pin, input[name="pin"], .modal-body input');
                await inputPin.click({ clickCount: 3 });
                await inputPin.type("123321"); 
                
                // Clica no botão de confirmação "Ok"
                const confirmBtn = await page.$('button.btn-success, .btn-primary, button#confirm');
                if (confirmBtn) {
                    await confirmBtn.click();
                } else {
                    await page.keyboard.press('Enter');
                }

                // Aguarda 4 segundos para o servidor processar a exclusão antes do próximo ciclo
                await new Promise(r => setTimeout(r, 4000));
            } catch (e) {
                console.log("Falha ao interagir com o modal de PIN.");
                break;
            }
        }

        pedido.mensagem = "✅ Dispositivo limpo!";
        
    } catch (err) {
        console.error("Erro no processo de limpeza:", err.message);
        pedido.mensagem = "❌ Erro ao acessar o site. Verifique MAC/Key.";
    } finally {
        if (browser) await browser.close();
    }
};
