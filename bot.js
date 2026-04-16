const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

async function executarBot(pedidos) {
  const pedido = pedidos.find(p => p.status === "pendente" || p.status === "processando");
  if (!pedido) return;

  pedido.status = "processando";
  const PIN_PADRAO = "123321";

  let browser;
  try {
    browser = await puppeteer.launch({
      args: [
        ...chromium.args,
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled", // Remove a bandeira de "sou um bot"
        "--disable-infobars",
        "--window-size=1920,1080",
        "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
      ],
      executablePath: await chromium.executablePath(),
      headless: true
    });

    const page = await browser.newPage();
    
    // Configurações para parecer um humano
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'pt-BR,pt;q=0.9' });
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'languages', { get: () => ['pt-BR', 'pt'] });
    });

    console.log(`[BOT] Iniciando acesso direto (Modo Furtivo) para ${pedido.nome}`);

    // Tenta acessar o login
    await page.goto("https://iboproapp.com/manage-playlists/login/", { 
      waitUntil: "networkidle2",
      timeout: 60000 
    });

    // Se o site der "Invalid Request", o bot vai esperar um pouco e tentar um reload
    const isInvalid = await page.evaluate(() => document.body.innerText.includes("Invalid request"));
    if (isInvalid) {
        console.log("[AVISO] Detectado Invalid Request. Aguardando 10s para tentar reload...");
        await new Promise(r => setTimeout(r, 10000));
        await page.reload({ waitUntil: "networkidle2" });
    }

    // Preenche login (simulando digitação humana)
    await page.type("input[name='mac_address']", pedido.mac, { delay: 100 });
    await page.type("input[name='password']", pedido.key, { delay: 100 });
    await page.click("button[type='submit']");
    
    await new Promise(r => setTimeout(r, 12000));

    // Vai para a lista e segue a lógica de exclusão
    await page.goto("https://iboproapp.com/manage-playlists/list/", { waitUntil: "networkidle2" });
    
    const clicou = await page.evaluate((nomeAlvo) => {
      const rows = Array.from(document.querySelectorAll('tr'));
      const alvo = rows.find(r => r.innerText.toUpperCase().includes(nomeAlvo.toUpperCase()));
      if (alvo) {
        const btn = alvo.querySelector('.delete_playlist');
        if (btn) { btn.click(); return true; }
      }
      return false;
    }, pedido.nome);

    if (clicou) {
      console.log(`[OK] Abrindo modal de PIN para ${pedido.nome}`);
      await new Promise(r => setTimeout(r, 4000));
      await page.keyboard.type(PIN_PADRAO, { delay: 150 });
      await page.keyboard.press('Enter');
      await new Promise(r => setTimeout(r, 10000));
      
      // Fecha o OK da confirmação
      await page.evaluate(() => {
        const btnOk = Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === 'Ok');
        if (btnOk) btnOk.click();
      });
    }

    pedido.status = "ok";
    console.log(`[SUCESSO] Processo finalizado para ${pedido.nome}`);

  } catch (err) {
    console.log(`[ERRO FINAL] ${err.message}`);
    pedido.status = "pendente";
  } finally {
    if (browser) await browser.close();
  }
}
module.exports = executarBot;
