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

        await page.goto("https://iboproapp.com/manage-playlists/login/", { 
            waitUntil: "networkidle2", 
            timeout: 60000 
        });
        
        // 1. Digita o MAC
        await page.waitForSelector("#mac_address", { timeout: 30000 });
        await page.click("#mac_address");
        await page.type("#mac_address", pedido.mac, { delay: 100 });

        // 2. Digita a Device Key (O ID AGORA É #password)
        const deviceKey = pedido.key || pedido.device_id;
        await page.waitForSelector("#password", { timeout: 20000 });
        await page.click("#password");
        await page.type("#password", deviceKey, { delay: 100 });
        
        // 3. Login
        await Promise.all([
            page.click("#login_btn"),
            page.waitForNavigation({ waitUntil: "networkidle2", timeout: 40000 })
        ]);

        // 4. Configuração da Playlist
        const dnsFinal = `http://xw.pluss.fun/get.php?username=${pedido.user}&password=${pedido.pass}&type=m3u_plus&output=ts`;
        
        await page.waitForSelector("#playlist_name", { timeout: 20000 });
        await page.type("#playlist_name", "ATV DIGITAL", { delay: 50 });
        await page.type("#playlist_url", dnsFinal, { delay: 50 });
        
        await page.click("#add_playlist_btn");
        await new Promise(r => setTimeout(r, 5000));

        if (config.manterAberto) {
            return { browser, page };
        } else {
            await browser.close();
            return null;
        }

    } catch (err) {
        console.error("❌ Erro no Engine:", err.message);
        if (browser) await browser.close();
        throw err;
    }
};
