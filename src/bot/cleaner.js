const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

module.exports = async (pedido) => {
    let browser;
    try {
        browser = await puppeteer.launch({
            args: [...chromium.args, "--no-sandbox"],
            executablePath: await chromium.executablePath(),
            headless: true // Mude para false se quiser ver o que o bot está fazendo no seu PC
        });

        const page = await browser.newPage();
        await page.setDefaultNavigationTimeout(60000);

        // 1. LOGIN
        pedido.mensagem = "Fazendo login no painel...";
        await page.goto("https://iboproapp.com/manage-playlists/login/", { waitUntil: "networkidle2" });
        
        await page.waitForSelector('input[name="mac_address"]', { timeout: 10000 });
        await page.type('input[name="mac_address"]', pedido.mac);
        await page.type('input[name="device_key"]', pedido.key);
        
        // Clica no botão de submit de forma mais robusta
        await Promise.all([
            page.click('button[type="submit"]'),
            page.waitForNavigation({ waitUntil: "networkidle2" })
        ]);

        // Verifica se o login realmente funcionou (procura pelo MAC na tela)
        const logado = await page.evaluate((mac) => document.body.innerText.includes(mac), pedido.mac);
        if (!logado) {
            pedido.mensagem = "❌ Erro: MAC ou Key incorretos.";
            return;
        }

        // 2. LOOP DE LIMPEZA
        while (true) {
            await page.reload({ waitUntil: "networkidle2" });
            
            // Busca todos os botões que contenham "Delete" no texto ou classe
            const deleteBtn = await page.evaluateHandle(() => {
                const btns = Array.from(document.querySelectorAll('button, a'));
                return btns.find(b => b.innerText.toLowerCase().includes('delete') || b.className.includes('btn-danger'));
            });

            if (!deleteBtn || !deleteBtn.asElement()) {
                console.log("Nenhuma playlist restando.");
                break; 
            }

            pedido.mensagem = "Localizou lista. Deletando...";
            await deleteBtn.asElement().click();

            // 3. CONFIRMAÇÃO DO PIN
            try {
                // Espera o modal ficar visível
                await page.waitForSelector('input#pin, input[name="pin"]', { visible: true, timeout: 8000 });
                await new Promise(r => setTimeout(r, 1000)); // Pequena pausa para o modal estabilizar

                // Digita o PIN (tenta múltiplos seletores)
                await page.focus('input#pin, input[name="pin"]');
                await page.keyboard.type("123321"); // Confirme se este é o seu PIN padrão
                
                // Clica no botão OK (verde) ou pressiona Enter
                const okBtn = await page.$('button.btn-success, .btn-primary');
                if (okBtn) await okBtn.click();
                else await page.keyboard.press('Enter');

                // Intervalo de 4 segundos para o servidor processar
                await new Promise(r => setTimeout(r, 4000));
            } catch (e) {
                console.log("Erro no modal do PIN, tentando recarregar...");
                continue;
            }
        }

        pedido.mensagem = "✅ Dispositivo limpo!";
        
    } catch (err) {
        console.error("Erro Geral Cleaner:", err.message);
        pedido.mensagem = "❌ Erro ao acessar o site. Tente novamente.";
    } finally {
        if (browser) await browser.close();
    }
};
