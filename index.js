const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");
const login = require("./tasks/login");
const addDns = require("./tasks/add-dns");
const setPin = require("./tasks/set-pin");
const submit = require("./tasks/submit");
// IMPORTANTE: Importar a lista de DNS aqui
const dnsConfig = require("../config/dns"); 

module.exports = async (pedidos) => {
    // Busca o pedido específico do IBO PRO
    const pedido = pedidos.find(p => p.tipo === "ibopro" && (p.status === "pendente" || p.status === "processando"));
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

        // Pegamos a lista de servidores do arquivo de config
        const servidores = dnsConfig.servidores;
        pedido.total = servidores.length;

        // 2. LOOP PELOS DNS
        for (let i = 0; i < servidores.length; i++) {
            const dnsBase = servidores[i];
            const nomeDns = dnsBase.split('//')[1].split('.')[0].toUpperCase();
            
            // MONTAGEM DO LINK: Aqui o robô cria o link m3u usando o user e pass do pedido
            const m3uLink = `${dnsBase}/get.php?username=${pedido.user}&password=${pedido.pass}&type=m3u_plus&output=ts`;
            
            pedido.indiceAtual = i + 1;
            pedido.mensagem = `Adicionando (${i + 1}/${pedido.total}): ${nomeDns}`;

            try {
                await addDns(page, nomeDns, m3uLink);
                await setPin(page, "123321");
                await submit(page);
                
                // Espera 2 segundos entre um DNS e outro para o site não travar
                await new Promise(r => setTimeout(r, 2000));
            } catch (errDns) {
                console.log(`Falha no DNS ${nomeDns}, pulando...`);
            }
        }

        pedido.status = "ok";
        pedido.mensagem = "✅ Todas as listas foram enviadas!";

    } catch (err) {
        pedido.status = "erro";
        pedido.mensagem = "Erro técnico: " + err.message;
    } finally {
        if (browser) await browser.close();
    }
};
