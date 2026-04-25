const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

module.exports = async (pedidos, config = {}) => {
    // 1. Verificação de segurança para evitar o erro "not iterable"
    if (!pedidos || !Array.isArray(pedidos)) {
        console.error("Erro: A lista de pedidos é inválida.");
        return null;
    }

    const pedido = pedidos.find(p => p.status === "processando");
    if (!pedido) return null;

    let browser;
    try {
        // 2. CORREÇÃO DO EXECUTABLEPATH (Erro do log 01:28)
        browser = await puppeteer.launch({
            args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox"],
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(), // Caminho correto para o Render
            headless: chromium.headless,
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // 3. Login no IBO Pro
        await page.goto("https://iboproapp.com/manage-playlists/login/", { waitUntil: "networkidle2" });
        
        await page.waitForSelector("#mac_address", { timeout: 15000 });
        await page.type("#mac_address", pedido.mac);
        await page.type("#device_id", pedido.key || pedido.device_id);
        
        await Promise.all([
            page.click("#login_btn"),
            page.waitForNavigation({ waitUntil: "networkidle2" })
        ]);

        // 4. DNS e Finalização
        const dnsFinal = `http://xw.pluss.fun/get.php?username=${pedido.user}&password=${pedido.pass}&type=m3u_plus&output=ts`;
        
        await page.waitForSelector("#playlist_name");
        await page.type("#playlist_name", "ATV DIGITAL");
        await page.type("#playlist_url", dnsFinal);
        await page.click("#add_playlist_btn");

        await new Promise(r => setTimeout(r, 3000));

        if (config.manterAberto) {
            return { browser, page };
        } else {
            await browser.close();
            return null;
        }

    } catch (err) {
        // 5. Tratamento de erro detalhado para não travar o servidor
        console.error("❌ Erro detalhado no Engine:", err.message);
        if (browser) await browser.close();
        throw err;
    }
};
