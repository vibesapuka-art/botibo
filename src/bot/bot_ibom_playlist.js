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
        
        // 1. ACESSA O DASHBOARD
        atualizarStatus(pedido.mac, "adicionando_playlist", "Acessando gerenciador...");
        // Aumentamos o tempo de espera para o carregamento inicial do dashboard
        await page.goto('https://iboplayer.com/dashboard', { waitUntil: 'networkidle2', timeout: 90000 });

        // 2. CLICA NO BOTÃO "ADD PLAYLIST"
        const seletorBotaoAdd = "button.bg-main.text-white"; 
        await page.waitForSelector(seletorBotaoAdd, { visible: true, timeout: 30000 });
        
        // Forçamos um pequeno delay antes do clique para garantir que o JS do site carregou
        await new Promise(r => setTimeout(r, 5000));
        await page.click(seletorBotaoAdd);
        
        // 3. PREENCHIMENTO DOS CAMPOS
        atualizarStatus(pedido.mac, "processando", "Configurando dados da playlist...");
        
        // Usamos um tempo maior para o formulário aparecer
        await page.waitForSelector("#playlist-name", { visible: true, timeout: 45000 });
        
        await page.type("#playlist-name", pedido.nome_lista || "Lista Canais", { delay: 100 });
        await page.type("#playlist-url", pedido.url_playlist, { delay: 100 });

        // 4. TRATAMENTO DO PIN (OPCIONAL)
        if (pedido.pin) {
            const seletorCheck = "div.border-\\[\\#B4B4B4\\]"; 
            await page.click(seletorCheck);
            await new Promise(r => setTimeout(r, 2000));
            await page.type("#pin", pedido.pin, { delay: 100 });
            await page.type("#confirm-pin", pedido.pin, { delay: 100 });
        }

        // 5. CLIQUE NO BOTÃO SAVE
        const seletorSave = "button[type='submit'].flex.ml-auto";
        await page.waitForSelector(seletorSave, { visible: true, timeout: 20000 });
        
        await Promise.all([
            page.click(seletorSave),
            page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 40000 }).catch(() => {})
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
