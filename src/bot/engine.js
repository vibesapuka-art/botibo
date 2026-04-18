const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

// Importa as tarefas individuais
const login = require("./tasks/login");
const addDns = require("./tasks/add-dns");
const setPin = require("./tasks/set-pin");
const submit = require("./tasks/submit");

module.exports = async (pedidos) => {
    // Busca o primeiro pedido pendente ou que já está sendo processado
    const pedido = pedidos.find(p => p.status === "pendente" || p.status === "processando");
    if (!pedido) return;

    pedido.status = "processando";
    pedido.mensagem = "Iniciando robô...";
    let browser;
    
    try {
        browser = await puppeteer.launch({
            args: [
                ...chromium.args, 
                "--no-sandbox", 
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--single-process"
            ],
            executablePath: await chromium.executablePath(),
            headless: true
        });

        const page = await browser.newPage();
        await page.setDefaultNavigationTimeout(60000);

        // 1. TENTATIVA DE LOGIN
        pedido.mensagem = "Fazendo login no IBO Player...";
        const sucessoLogin = await login(page, pedido.mac, pedido.key);
        
        if (!sucessoLogin) {
            pedido.status = "erro";
            pedido.mensagem = "Erro: MAC ou Key inválidos.";
            return; // Interrompe o processo aqui
        }

        // 2. ADICIONAR PLAYLIST (DNS)
        pedido.mensagem = "Configurando servidor DNS...";
        // Gera um nome baseado no final do MAC para ser único
        const nomeIdentificador = "IPTV_" + pedido.mac.slice(-4).toUpperCase();
        await addDns(page, nomeIdentificador, pedido.m3u);

        // 3. CONFIGURAR PIN
        pedido.mensagem = "Ativando PIN de segurança (123321)...";
        await setPin(page, "123321");

        // 4. FINALIZAR E SALVAR
        pedido.mensagem = "Salvando alterações no site...";
        await submit(page);

        // SUCESSO
        pedido.status = "ok";
        pedido.mensagem = "Finalizado com sucesso!";
        console.log(`Sucesso: ${pedido.mac} finalizado.`);

    } catch (err) {
        console.error(`Erro no processamento:`, err.message);
        pedido.status = "erro";
        pedido.mensagem = "Erro técnico: " + err.message;
    } finally {
        if (browser) await browser.close();
    }
};
