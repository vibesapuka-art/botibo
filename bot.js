const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

async function executarBot(pedidos) {
    // Busca apenas pedidos que ainda não falharam e não terminaram
    const pedido = pedidos.find(p => p.status === "pendente" || p.status === "processando");
    if (!pedido) return;

    pedido.status = "processando";
    let browser;

    try {
        browser = await puppeteer.launch({
            args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox"],
            executablePath: await chromium.executablePath(),
            headless: true
        });

        const page = await browser.newPage();
        await page.goto("https://iboplayer.pro/manage-playlists/login/", { waitUntil: "networkidle2", timeout: 60000 });

        await page.type("input[name='mac_address']", pedido.mac);
        await page.type("input[name='password']", pedido.key);
        await page.click("button[type='submit']");

        await new Promise(r => setTimeout(r, 10000)); // Tempo para o site processar o login

        // VERIFICAÇÃO CRUCIAL
        const erroDetectado = await page.evaluate(() => {
            const corpo = document.body.innerText;
            return corpo.includes("Invalid request") || 
                   corpo.includes("Wrong") || 
                   document.querySelector("input[name='mac_address']") !== null;
        });

        if (erroDetectado) {
            console.log(`[PAINEL] Enviando erro de login para o MAC: ${pedido.mac}`);
            pedido.status = "erro_login"; // O index.html vai ler isso no próximo fetch
            return; 
        }

        // Se passar daqui, continua a criação normal...
        pedido.status = "ok"; 
        pedido.concluidos = 15;

    } catch (err) {
        console.log("[ERRO BOT]:", err.message);
        // Não muda para erro_login aqui para o bot poder tentar de novo se for erro de internet
    } finally {
        if (browser) await browser.close();
    }
}

module.exports = executarBot;
