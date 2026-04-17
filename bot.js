const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

async function executarBot(pedidos) {
    const pedido = pedidos.find(p => p.status === "pendente" || p.status === "processando");
    if (!pedido) return;

    pedido.status = "processando";
    let browser;

    try {
        browser = await puppeteer.launch({
            args: [
                ...chromium.args,
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage", // Essencial para o plano gratuito do Render
                "--single-process"
            ],
            executablePath: await chromium.executablePath(),
            headless: true
        });

        const page = await browser.newPage();
        await page.setDefaultNavigationTimeout(60000);

        // 1. LOGIN
        await page.goto("https://iboplayer.pro/manage-playlists/login/", { waitUntil: "networkidle2" });
        await page.type("input[name='mac_address']", pedido.mac);
        await page.type("input[name='password']", pedido.key);
        await page.click("button[type='submit']");
        
        await new Promise(r => setTimeout(r, 10000));

        // VERIFICAÇÃO DE DADOS INCORRETOS
        const erroLogin = await page.evaluate(() => {
            return document.body.innerText.includes("Invalid request") || 
                   document.querySelector("input[name='mac_address']") !== null;
        });

        if (erroLogin) {
            console.log(`[AVISO] Dados inválidos para MAC: ${pedido.mac}`);
            pedido.status = "erro_login"; // Envia para o painel do cliente
            return;
        }

        // 2. ADIÇÃO DE PLAYLIST (Exemplo simplificado)
        await page.goto("https://iboplayer.pro/manage-playlists/list/", { waitUntil: "networkidle2" });
        // ... sua lógica de preenchimento ...
        
        pedido.status = "ok";
        pedido.concluidos = 15;

    } catch (err) {
        console.log("[ERRO SISTEMA]:", err.message);
        pedido.status = "erro_sistema"; // Notifica instabilidade no painel
    } finally {
        if (browser) await browser.close();
    }
}

module.exports = executarBot;
