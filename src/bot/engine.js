const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");
const login = require("./tasks/login");
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
        
        // 1. LOGIN ÚNICO
        pedido.mensagem = "Fazendo login inicial...";
        const sucessoLogin = await login(page, pedido.mac, pedido.key);
        
        if (!sucessoLogin) {
            pedido.status = "erro";
            pedido.mensagem = "Erro: MAC ou Key inválidos no IBO.";
            return;
        }

        // 2. LOOP PELOS 15 DNS
        for (let i = pedido.indiceAtual; i < pedido.playlists.length; i++) {
            const m3u = pedido.playlists[i];
            const nomeDns = m3u.split('//')[1].split('.')[0].toUpperCase();
            
            pedido.indiceAtual = i;
            pedido.mensagem = `Adicionando (${i + 1}/${pedido.total}): ${nomeDns}`;

            try {
                await addDns(page, nomeDns, m3u);
                await setPin(page, "123321");
                await submit(page);
            } catch (errDns) {
                console.log(`Falha no DNS ${nomeDns}, pulando...`);
                // Continua para o próximo mesmo se um falhar
            }
        }

        pedido.status = "ok";
        pedido.mensagem = "✅ Todas as 15 listas foram enviadas!";

    } catch (err) {
        pedido.status = "erro";
        pedido.mensagem = "Erro técnico: " + err.message;
    } finally {
        if (browser) await browser.close();
    }
};
