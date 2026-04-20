const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

async function adicionarPlaylistIbo(pedido, atualizarStatus) {
    let browser;
    try {
        browser = await puppeteer.launch({
            args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox"],
            executablePath: await chromium.executablePath(),
            headless: true
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 1600 });
        
        // 1. ACESSA O DASHBOARD JÁ LOGADO
        atualizarStatus(pedido.mac, "adicionando_playlist", "Acessando gerenciador de listas...");
        await page.goto('https://iboplayer.com/dashboard', { waitUntil: 'networkidle2', timeout: 60000 });

        // 2. CLICA NO BOTÃO "ADD PLAYLIST"
        const seletorBotaoAdd = "button.bg-main.text-white"; 
        await page.waitForSelector(seletorBotaoAdd, { visible: true, timeout: 15000 });
        await page.click(seletorBotaoAdd);
        
        // Aguarda carregar o formulário
        await new Promise(r => setTimeout(r, 2500));

        // 3. PREENCHIMENTO DOS CAMPOS
        atualizarStatus(pedido.mac, "processando", "Configurando dados da playlist...");
        
        // Nome da Playlist (conforme seu código: id="playlist-name")
        await page.waitForSelector("#playlist-name", { visible: true });
        await page.type("#playlist-name", pedido.nome_lista || "Lista Canais", { delay: 60 });
        
        // URL da Playlist (conforme seu código: id="playlist-url")
        await page.type("#playlist-url", pedido.url_playlist, { delay: 60 });

        // 4. TRATAMENTO DO PIN (OPCIONAL)
        if (pedido.pin) {
            // Clica na div do checkbox para liberar os campos de senha
            const seletorCheck = "div.border-\\[\\#B4B4B4\\]"; // Escape para caracteres especiais do Tailwind
            await page.click(seletorCheck);
            await new Promise(r => setTimeout(r, 800));
            
            // Preenche Pin e Confirmação (ids: pin e confirm-pin)
            await page.type("#pin", pedido.pin, { delay: 60 });
            await page.type("#confirm-pin", pedido.pin, { delay: 60 });
        }

        // 5. CLIQUE NO BOTÃO SAVE (USANDO O CÓDIGO QUE VOCÊ ENVIOU)
        // Seletor baseado em type="submit" para ser único
        const seletorSave = "button[type='submit'].flex.ml-auto";
        await page.waitForSelector(seletorSave, { visible: true });
        
        await Promise.all([
            page.click(seletorSave),
            // Aguarda o site processar o salvamento (geralmente recarrega a lista)
            page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {})
        ]);
        
        atualizarStatus(pedido.mac, "ok", "✅ Playlist adicionada com sucesso!");

    } catch (error) {
        console.error("Erro na Playlist:", error.message);
        atualizarStatus(pedido.mac, "erro", "Erro na Playlist: " + error.message);
    } finally {
        if (browser) await browser.close();
    }
}

module.exports = { adicionarPlaylistIbo };
