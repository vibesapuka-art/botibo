const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");
const todosDNS = require("../config/dns"); 

module.exports = async (pedidos, config = {}) => {
    if (!pedidos || !Array.isArray(pedidos)) return null;
    const pedido = pedidos.find(p => p.status === "processando");
    if (!pedido) return null;

    let browser;
    try {
        browser = await puppeteer.launch({
            args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox"],
            executablePath: await chromium.executablePath(),
            headless: true,
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

        // Sorteia 5 DNS da tua lista de 15
        const dnsSorteados = [...todosDNS]
            .sort(() => 0.5 - Math.random())
            .slice(0, 5);

        // 1. LOGIN
        pedido.mensagem = "📡 Acessando painel IBO...";
        await page.goto("https://iboproapp.com/manage-playlists/login/", { waitUntil: "domcontentloaded", timeout: 60000 });
        
        await page.waitForSelector("#mac_address", { timeout: 30000 });
        await page.type("#mac_address", pedido.mac, { delay: 50 });
        await page.type("#password", (pedido.key || pedido.device_id), { delay: 50 });
        await page.keyboard.press('Enter');
        
        await page.waitForSelector('button.btn-secondary', { timeout: 45000 });

        // 2. LOOP DE ADIÇÃO
        for (let i = 0; i < dnsSorteados.length; i++) {
            const nomeLista = `IMPTV${i + 1}`;
            const baseDns = dnsSorteados[i];
            
            // MONTAGEM CORRETA DA URL: DNS + USER + PASS
            // Usamos template literals para garantir que os dados do formulário entrem aqui
            const urlFinal = `${baseDns}/get.php?username=${pedido.user}&password=${pedido.pass}&type=m3u_plus&output=ts`;

            pedido.mensagem = `📝 Gravando ${nomeLista}...`;

            // Abre o Modal
            await page.evaluate(() => {
                const btnAdd = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Add Playlist'));
                if (btnAdd) btnAdd.click();
            });

            await page.waitForSelector('input[name="name"]', { timeout: 15000 });
            
            // Limpa e digita os dados novos
            await page.type('input[name="name"]', nomeLista, { delay: 50 });
            await page.type('input[name="url"]', urlFinal, { delay: 50 });

            // ATIVAÇÃO DO PIN 123321
            await page.click('#playlist-protected');
            await new Promise(r => setTimeout(r, 800)); 
            
            await page.type('input[name="pin"]', "123321", { delay: 50 });
            await page.type('input[name="cpin"]', "123321", { delay: 50 });
            
            await page.keyboard.press('Enter');
            
            // Aguarda o site salvar antes de recarregar
            await new Promise(r => setTimeout(r, 7000)); 
            
            await page.reload({ waitUntil: "domcontentloaded" });
            await page.waitForSelector('button.btn-secondary', { timeout: 20000 });
        }

        pedido.mensagem = "✅ 5 listas configuradas com sucesso!";
        pedido.status = "ok";

        if (config.manterAberto) {
            return { browser, page };
        } else {
            await browser.close();
            return null;
        }

    } catch (err) {
        console.error("❌ Erro:", err.message);
        if (browser) {
            const pages = await browser.pages();
            if (pages[0]) await pages[0].screenshot({ path: 'public/erro_final.png', fullPage: true });
            await browser.close();
        }
        throw err;
    }
};
