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

        // 1. Login
        await page.goto("https://iboproapp.com/manage-playlists/login/", { waitUntil: "domcontentloaded", timeout: 60000 });
        await page.waitForSelector("#mac_address", { timeout: 30000 });
        await page.type("#mac_address", pedido.mac, { delay: 50 });
        await page.type("#password", (pedido.key || pedido.device_id), { delay: 50 });
        await page.keyboard.press('Enter');
        
        pedido.mensagem = "📡 Painel acessado, verificando listas...";
        await page.waitForSelector('button.btn-secondary', { timeout: 45000 });

        // 2. Definir nome sequencial (IMPTV1, IMPTV2...)
        const totalListasExistentes = await page.$$eval('button.btn-warning', btns => btns.length);
        const proximoNumero = totalListasExistentes + 1;
        const nomeLista = `IMPTV${proximoNumero}`;

        // 3. Abrir Modal de Adição
        await page.evaluate(() => {
            const btnAdd = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Add Playlist'));
            if (btnAdd) btnAdd.click();
        });

        // 4. Preencher Modal com PIN
        await page.waitForSelector('input[name="name"]', { timeout: 15000 });
        const dnsFinal = `http://xw.pluss.fun/get.php?username=${pedido.user}&password=${pedido.pass}&type=m3u_plus&output=ts`;
        
        pedido.mensagem = `📝 Adicionando ${nomeLista}...`;
        await page.type('input[name="name"]', nomeLista, { delay: 50 });
        await page.type('input[name="url"]', dnsFinal, { delay: 50 });

        // ATIVAR PROTEÇÃO POR PIN
        console.log("Ativando proteção por PIN...");
        await page.click('#playlist-protected'); // Clica no checkbox
        
        // Espera os campos de PIN serem habilitados
        await new Promise(r => setTimeout(r, 1000));
        
        await page.type('input[name="pin"]', "123321", { delay: 100 });
        await page.type('input[name="cpin"]', "123321", { delay: 100 });
        
        // 5. Submit Final
        await page.keyboard.press('Enter');
        
        // Feedback visual do status
        await new Promise(r => setTimeout(r, 5000));
        pedido.mensagem = `✅ ${nomeLista} adicionada com PIN!`;

        if (config.manterAberto) {
            return { browser, page };
        } else {
            await browser.close();
            return null;
        }

    } catch (err) {
        if (browser) {
            const pages = await browser.pages();
            if (pages[0]) await pages[0].screenshot({ path: 'public/erro_final.png' });
        }
        console.error("❌ Erro no Engine:", err.message);
        throw err;
    }
};
