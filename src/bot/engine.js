const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

module.exports = async (pedidos, config = {}) => {
    if (!pedidos || !Array.isArray(pedidos)) return null;

    // Busca o pedido que o index.js marcou como processando
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
        // User-Agent real para evitar ser barrado como bot
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // Login no IBO Pro
        await page.goto("https://iboproapp.com/manage-playlists/login/", { 
            waitUntil: "networkidle2", 
            timeout: 60000 
        });
        
        // Espera e preenche o MAC
        await page.waitForSelector("#mac_address", { timeout: 20000 });
        await page.type("#mac_address", pedido.mac, { delay: 50 });

        // Tenta preencher o Device ID (Key)
        const deviceId = pedido.key || pedido.device_id;
        await page.waitForSelector("#device_id", { timeout: 10000 });
        await page.type("#device_id", deviceId, { delay: 50 });
        
        // Clica em Login e aguarda a entrada
        await Promise.all([
            page.click("#login_btn"),
            page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 })
        ]);

        // Configuração do DNS
        const dnsFinal = `http://xw.pluss.fun/get.php?username=${pedido.user}&password=${pedido.pass}&type=m3u_plus&output=ts`;
        
        await page.waitForSelector("#playlist_name", { timeout: 15000 });
        await page.type("#playlist_name", "ATV DIGITAL");
        await page.type("#playlist_url", dnsFinal);
        
        await page.click("#add_playlist_btn");
        
        // Espera o site processar o salvamento
        await new Promise(r => setTimeout(r, 4000));

        if (config.manterAberto) {
            return { browser, page };
        } else {
            await browser.close();
            return null;
        }

    } catch (err) {
        console.error("❌ Erro no Engine:", err.message);
        if (browser) await browser.close();
        throw err; // Repassa o erro para o catch do index.js
    }
};
