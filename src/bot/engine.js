const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

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
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

        // Login
        await page.goto("https://iboproapp.com/manage-playlists/login/", { waitUntil: "networkidle2", timeout: 60000 });
        await page.waitForSelector("#mac_address", { timeout: 30000 });
        await page.type("#mac_address", pedido.mac, { delay: 100 });
        await page.type("#password", (pedido.key || pedido.device_id), { delay: 100 });
        await page.keyboard.press('Enter');
        
        console.log("Login realizado, aguardando painel...");
        await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 45000 });

        // 1. Clica no botão "Add Playlist" (O botão cinza que você mandou antes)
        console.log("Abrindo modal de Playlist...");
        await page.waitForSelector('button.btn-secondary', { timeout: 20000 });
        await page.evaluate(() => {
            const btnAdd = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Add Playlist'));
            if (btnAdd) btnAdd.click();
        });

        // 2. Preenche o Modal (Usando os nomes que você extraiu)
        const dnsFinal = `http://xw.pluss.fun/get.php?username=${pedido.user}&password=${pedido.pass}&type=m3u_plus&output=ts`;
        await page.waitForSelector('input[name="name"]', { timeout: 15000 });
        
        await page.type('input[name="name"]', "ATV DIGITAL", { delay: 50 });
        await page.type('input[name="url"]', dnsFinal, { delay: 50 });
        
        // 3. Clique no botão SUBMIT (O botão azul que você mandou agora)
        console.log("Confirmando envio da playlist...");
        await page.waitForSelector('button.btn-primary[type="submit"]', { timeout: 10000 });
        await page.click('button.btn-primary[type="submit"]');
        
        // Espera um pouco para o site processar o salvamento
        await new Promise(r => setTimeout(r, 6000));

        if (config.manterAberto) {
            return { browser, page };
        } else {
            await browser.close();
            return null;
        }

    } catch (err) {
        console.error("❌ Erro detalhado no Engine:", err.message);
        if (browser) await browser.close();
        throw err;
    }
};
