const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

module.exports = async (pedido, status) => {
    let browser;
    try {
        browser = await puppeteer.launch({
            args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox"],
            executablePath: await chromium.executablePath(),
            headless: true 
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });

        // 1. LOGIN NO PAINEL
        if(status) status.mensagem = "Conectando ao painel IBO...";
        await page.goto("https://iboproapp.com/manage-playlists/login/", { waitUntil: "networkidle2" });
        
        await page.waitForSelector('#mac_address');
        await page.type('#mac_address', pedido.mac);
        await page.type('#password', pedido.key); // ID password conforme seu código-fonte
        
        await Promise.all([
            page.click('button[type="submit"]'),
            page.waitForNavigation({ waitUntil: "networkidle2" })
        ]);

        // 2. ADICIONAR PLAYLIST
        if(status) status.mensagem = "Adicionando sua nova lista...";
        
        // Clica no botão de adicionar (geralmente 'Add Playlist')
        const addBtn = await page.$('.btn-primary'); 
        if (addBtn) await addBtn.click();

        await page.waitForSelector('input[name="playlist_name"]', { visible: true });
        
        // Preenche os dados IPTV
        await page.type('input[name="playlist_name"]', "TV DIGITAL");
        await page.type('input[name="username"]', pedido.usuario);
        await page.type('input[name="password"]', pedido.senha);
        await page.type('input[name="host"]', "http://xw.pluss.fun"); // Seu DNS padrão

        // Salva a lista
        await page.keyboard.press('Enter');
        
        // Espera um pouco para o servidor processar
        await new Promise(r => setTimeout(r, 5000));

        if(status) status.mensagem = "✅ Ativação concluída!";
        
    } catch (err) {
        console.error("Erro no Activator:", err.message);
        if(status) status.mensagem = "❌ Erro na ativação técnica.";
    } finally {
        if (browser) await browser.close();
    }
};
