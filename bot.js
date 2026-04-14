const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

async function executarBot(pedidos) {
  const pedido = pedidos.find(p => p.status === "pendente");
  if (!pedido) return;

  // Marca como processando IMEDIATAMENTE
  pedido.status = "processando";
  console.log("PROCESSANDO DNS:", pedido.m3u);

  let browser;
  try {
    browser = await puppeteer.launch({
      args: [
        ...chromium.args,
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage", // Ajuda muito no Render (plano grátis)
        "--single-process"         // Economiza memória
      ],
      executablePath: await chromium.executablePath(),
      headless: true
    });

    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(60000);

    // LOGIN
    await page.goto("https://iboplayer.pro/manage-playlists/login/", { waitUntil: "networkidle2" });
    await page.type("input[name='mac_address']", pedido.mac);
    await page.type("input[name='password']", pedido.key);
    
    await page.evaluate(() => {
      const btn = document.querySelector("button[type='submit']");
      if (btn) { btn.disabled = false; btn.click(); }
    });

    await new Promise(r => setTimeout(r, 10000));

    // LISTA E SALVAMENTO
    await page.goto("https://iboplayer.pro/manage-playlists/list/", { waitUntil: "networkidle2" });
    
    // Verifica se já existe
    const existe = await page.evaluate(m => document.body.innerText.includes(m), pedido.m3u);
    if (existe) {
      console.log("DNS já cadastrado.");
      pedido.status = "ok";
      return;
    }

    // Processo de Adicionar (mesmo código anterior...)
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find(el => el.innerText.includes("Add Playlist"));
      if (btn) btn.click();
    });

    await new Promise(r => setTimeout(r, 3000));
    const inputs = await page.$$("input");
    if (inputs.length >= 2) {
      await inputs[0].type(pedido.nome);
      await inputs[1].type(pedido.m3u);
      await page.keyboard.press("Enter");
      await new Promise(r => setTimeout(r, 8000));
      pedido.status = "ok";
      console.log("SUCESSO NO DNS:", pedido.m3u);
    }

  } catch (err) {
    console.log("FALHA:", err.message);
    pedido.status = "pendente"; // Volta para a fila se falhar por timeout
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = executarBot;
