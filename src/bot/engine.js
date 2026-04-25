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
        await page.setViewport({ width: 1280, height: 800 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

        await page.goto("https://iboproapp.com/manage-playlists/login/", { waitUntil: "domcontentloaded", timeout: 60000 });
        
        // Preenchimento de Login
        await page.waitForSelector("#mac_address", { timeout: 20000 });
        await page.type("#mac_address", pedido.mac, { delay: 50 });
        await page.type("#password", (pedido.key || pedido.device_id), { delay: 50 });
        await page.keyboard.press('Enter');

        // Aguarda a transição para o painel
        await page.waitForSelector('button.btn-secondary', { timeout: 45000 });

        // Abre modal e preenche
        await page.evaluate(() => {
            const btnAdd = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Add Playlist'));
            if (btnAdd) btnAdd.click();
        });

        await page.waitForSelector('input[name="name"]', { timeout: 15000 });
        const dnsFinal = `http://xw.pluss.fun/get.php?username=${pedido.user}&password=${pedido.pass}&type=m3u_plus&output=ts`;
        
        await page.type('input[name="name"]', "ATV DIGITAL", { delay: 50 });
        await page.type('input[name="url"]', dnsFinal, { delay: 50 });
        
        await page.keyboard.press('Enter');
        await new Promise(r => setTimeout(r, 5000));

        if (config.manterAberto) {
            return { browser, page };
        } else {
            await browser.close();
            return null;
        }

    } catch (err) {
        // CAPTURA DE PRINT APENAS EM CASO DE ERRO
        if (browser) {
            const pages = await browser.pages();
            const activePage = pages[0];
            if (activePage) {
                console.log("📸 Gerando print do erro em public/erro_final.png");
                await activePage.screenshot({ path: 'public/erro_final.png', fullPage: true });
            }
            await browser.close();
        }
        console.error("❌ Erro detectado:", err.message);
        throw err;
    }
};
