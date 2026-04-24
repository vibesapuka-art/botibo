const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

module.exports = async (pedido) => {
    let browser;
    try {
        browser = await puppeteer.launch({
            args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox"],
            executablePath: await chromium.executablePath(),
            headless: true
        });

        const page = await browser.newPage();
        
        // Aumentamos o timeout para 60s para dar tempo do Cloudflare validar
        await page.goto("https://gestorv3.com.br/central/registrar/", { 
            waitUntil: "networkidle2", 
            timeout: 60000 
        });

        // Espera 10 segundos extras para garantir que o widget do Cloudflare sumiu
        // e o formulário está clicável
        await new Promise(r => setTimeout(r, 10000));

        // Espera um campo específico do formulário aparecer antes de digitar
        await page.waitForSelector('input[placeholder="Seu nome"]', { timeout: 15000 });

        // Preenche os Dados Pessoais
        await page.type('input[placeholder="Seu nome"]', pedido.nome);
        await page.type('input[placeholder="Seu sobrenome"]', pedido.sobrenome || "Cliente");

        // Credenciais (Usuário e Senha IPTV)
        await page.type('input[placeholder="Crie um usuário"]', pedido.user);
        await page.type('input[placeholder="Crie uma senha"]', pedido.pass);
        
        // Contato
        if (pedido.whatsapp) {
            await page.type('input[placeholder="(00) 00000-0000"]', pedido.whatsapp);
        }

        // Clica em Criar Conta
        await page.click('button.bg-purple-600'); 
        
        // Espera a confirmação de que o cadastro foi feito
        await page.waitForNavigation({ timeout: 15000 }).catch(() => console.log("Aguardando redirecionamento..."));
        
        console.log(`Sucesso: ${pedido.nome} cadastrado no Gestor V3.`);

    } catch (err) {
        console.error("Erro no cadastro do Gestor (provável bloqueio Cloudflare):", err.message);
    } finally {
        if (browser) await browser.close();
    }
};
