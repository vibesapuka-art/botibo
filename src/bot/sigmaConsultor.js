const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

module.exports = async (whatsappCliente) => {
    let browser;
    try {
        const executablePath = await chromium.executablePath();
        browser = await puppeteer.launch({
            args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox"],
            executablePath: executablePath,
            headless: chromium.headless,
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });

        // 1. LOGIN NO SIGMA
        await page.goto("https://netplay.mplll.com/#/dashboard", { waitUntil: "networkidle2" });
        
        await page.waitForSelector('input[name="username"]');
        await page.type('input[name="username"]', 'Jeferson0110', { delay: 50 }); // Login
        await page.type('input[name="password"]', 'Jeferson0110@', { delay: 50 }); // Senha
        
        await page.click('button[type="submit"]'); // Ou o botão "Continuar"
        await page.waitForNavigation({ waitUntil: 'networkidle2' });

        // 2. IR PARA ÁREA DO CLIENTE
        await page.waitForSelector('.fad.fa-users'); 
        await page.click('.fad.fa-users');

        // 3. PESQUISAR PELO CONTATO
        await page.waitForSelector('input[placeholder="Pesquisar"]');
        await page.type('input[placeholder="Pesquisar"]', whatsappCliente);
        await new Promise(r => setTimeout(r, 2000)); // Aguarda o filtro da tabela

        // 4. ABRIR PLAYLIST (MODAL)
        await page.waitForSelector('.fad.fa-tv');
        await page.click('.fad.fa-tv');

        // 5. COLETAR INFORMAÇÕES DO MODAL
        await page.waitForSelector('.pre');
        const dadosCompletos = await page.evaluate(() => {
            const elemento = document.querySelector('.d-flex.flex-column.pre');
            return elemento ? elemento.innerText.trim() : "Dados não encontrados.";
        });

        await browser.close();
        return dadosCompletos;

    } catch (err) {
        if (browser) await browser.close();
        console.error("Erro na consulta Sigma:", err.message);
        throw new Error("Não foi possível localizar seus dados. Verifique o número digitado.");
    }
};
