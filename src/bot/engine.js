const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

/**
 * Motor de Ativação Técnica - IBO Pro
 * @param {Array} pedidos - Lista contendo o objeto do pedido
 * @param {Object} config - Configurações extras (ex: manterAberto)
 */
module.exports = async (pedidos, config = {}) => {
    // Procura o pedido que está com status processando
    const pedido = pedidos.find(p => p.status === "processando" && p.tipo === "ibopro");
    if (!pedido) return null;

    let browser;
    try {
        // Inicializa o navegador (Otimizado para o Render)
        browser = await puppeteer.launch({
            args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox"],
            executablePath: await chromium.executablePath(),
            headless: true
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 720 });

        // 1. Acessa o site do IBO Player Pro
        await page.goto("https://iboproapp.com/manage-playlists/login/", { waitUntil: "networkidle2" });

        // 2. Login com MAC e Device ID
        await page.type("#mac_address", pedido.mac);
        await page.type("#device_id", pedido.key || pedido.device_id); // Aceita 'key' ou 'device_id'
        
        await Promise.all([
            page.click("#login_btn"),
            page.waitForNavigation({ waitUntil: "networkidle2" })
        ]);

        // 3. Adiciona a Playlist (DNS Corrigido)
        // Usamos pedido.user e pedido.pass que tratamos no index.js
        const dnsFinal = `http://xw.pluss.fun/get.php?username=${pedido.user}&password=${pedido.pass}&type=m3u_plus&output=ts`;
        
        await page.waitForSelector("#playlist_name");
        await page.type("#playlist_name", "ATV DIGITAL");
        await page.type("#playlist_url", dnsFinal);

        // Clique no botão de salvar/adicionar
        await page.click("#add_playlist_btn");
        
        // Pequena pausa para garantir o salvamento no banco deles
        await new Promise(r => setTimeout(r, 3000));

        console.log(`✅ DNS Configurado para MAC: ${pedido.mac}`);

        // --- LÓGICA DE PASSAGEM DE BASTÃO ---
        if (config.manterAberto) {
            // Se for modo NOVO, retornamos o navegador vivo para o index.js usar no gestor
            return { browser, page };
        } else {
            // Se for ASSINANTE, fecha tudo agora para economizar RAM
            await browser.close();
            return null;
        }

    } catch (err) {
        console.error("❌ Erro no Engine:", err.message);
        if (browser) await browser.close();
        throw err;
    }
};
