const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

// Importa as tarefas individuais
const login = require("./tasks/login");
const check = require("./tasks/check");
const addDns = require("./tasks/add-dns");
const setPin = require("./tasks/set-pin");
const submit = require("./tasks/submit");

module.exports = async (pedidos) => {
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
        await page.setDefaultNavigationTimeout(60000);

        // 1. LOGIN
        await login(page, pedido.mac, pedido.key);
        
        // 2. EXTRAIR NOME E VERIFICAR
        const nome = pedido.m3u.split('//')[1].split('.')[0].toUpperCase();
        const existe = await check(page, nome);
        
        if (!existe) {
            // 3. ADICIONAR DADOS
            await addDns(page, nome, pedido.m3u);
            // 4. CONFIGURAR PIN
            await setPin(page, "123321");
            // 5. ENVIAR
            await submit(page);
        }

        pedido.status = "ok";
        console.log(`Sucesso: ${pedido.mac} finalizado.`);

    } catch (err) {
        console.error(`Erro ao processar ${pedido.mac}:`, err.message);
        pedido.status = "pendente"; 
    } finally {
        if (browser) await browser.close();
    }
};
