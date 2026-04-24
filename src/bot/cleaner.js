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
        
        // Login no Gerenciador de Playlists
        await page.goto("https://iboproapp.com/manage-playlists/login/", { waitUntil: "networkidle2" });
        await page.type('input[name="mac_address"]', pedido.mac);
        await page.type('input[name="device_key"]', pedido.key);
        await page.click('button[type="submit"]');
        await page.waitForNavigation({ waitUntil: "networkidle2" });

        // Loop de exclusão profunda
        while (true) {
            // Recarrega a página para garantir que a lista está atualizada
            await page.reload({ waitUntil: "networkidle2" });
            
            // Procura todos os botões "Delete" visíveis
            const deleteButtons = await page.$$('.btn-danger, button.btn-delete, a.btn-delete');
            
            if (deleteButtons.length === 0) {
                console.log("Nenhuma playlist encontrada para deletar.");
                break; 
            }

            pedido.mensagem = `Removendo lista (Restam ${deleteButtons.length})...`;
            
            // Clica no primeiro botão de deletar da lista
            await deleteButtons[0].click();

            // AGUARDA O MODAL DE PIN APARECER
            try {
                // Espera o seletor do PIN ou o título "Confirm Your PIN"
                await page.waitForSelector('input[name="pin"], #pin', { visible: true, timeout: 5000 });
                
                // Limpa e digita o PIN (geralmente 123321 ou o definido pelo usuário)
                await page.click('input[name="pin"], #pin', { clickCount: 3 }); 
                await page.type('input[name="pin"], #pin', "123321"); 

                // Clica no botão "Ok" do modal
                const okButton = await page.$('button.btn-success, .modal-footer .btn-primary, button:contains("Ok")');
                if (okButton) {
                    await okButton.click();
                } else {
                    await page.keyboard.press('Enter');
                }

                // Espera essencial de 4 segundos para o servidor processar a exclusão
                await new Promise(r => setTimeout(r, 4000));

            } catch (pinError) {
                console.log("Modal de PIN não apareceu ou erro ao digitar.");
                // Se der erro, tenta recarregar e continuar
                continue;
            }
        }
        
        pedido.mensagem = "✅ Dispositivo limpo com sucesso!";
    } catch (err) {
        pedido.mensagem = "❌ Erro ao acessar o painel de limpeza.";
        console.error("Erro Cleaner:", err.message);
    } finally {
        if (browser) await browser.close();
    }
};
