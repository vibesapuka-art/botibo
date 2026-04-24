const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");
const login = require("./tasks/login");

module.exports = async (pedido) => {
    let browser;
    try {
        browser = await puppeteer.launch({
            args: [...chromium.args, "--no-sandbox"],
            executablePath: await chromium.executablePath(),
            headless: true
        });

        const page = await browser.newPage();
        const sucessoLogin = await login(page, pedido.mac, pedido.key);
        if (!sucessoLogin) return;

        while (true) {
            const deleteBtn = await page.$('.btn-danger, button[onclick*="delete"]');
            if (!deleteBtn) break;

            await deleteBtn.click();
            await new Promise(r => setTimeout(r, 2000));

            // Digita o PIN 123321
            const inputs = await page.$$('input');
            for (let input of inputs) {
                const type = await page.evaluate(el => el.type, input);
                if (type === 'text' || type === 'password') {
                    await input.type("123321");
                }
            }

            await page.keyboard.press('Enter');
            await new Promise(r => setTimeout(r, 4000)); // Espera 4 segundos
            await page.reload({ waitUntil: "networkidle2" });
        }
    } catch (err) {
        console.error("Erro Cleaner:", err.message);
    } finally {
        if (browser) await browser.close();
    }
};
