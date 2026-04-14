const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

async function executarBot(pedidos) {
  const pedido = pedidos.find(p => p.status === "pendente");
  if (!pedido) return;

  console.log("PROCESSANDO DNS:", pedido.m3u);
  let browser;

  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true
    });

    const page = await browser.newPage();
    
    // LOGIN
    await page.goto("https://iboplayer.pro/manage-playlists/login/");
    await page.waitForSelector("input[name='mac_address']");
    await page.type("input[name='mac_address']", pedido.mac);
    await page.type("input[name='password']", pedido.key);
    
    await page.evaluate(() => {
      const btn = document.querySelector("button[type='submit']");
      if (btn) { btn.disabled = false; btn.click(); }
    });

    await new Promise(r => setTimeout(r, 8000));

    // LISTA E VERIFICAÇÃO
    await page.goto("https://iboplayer.pro/manage-playlists/list/");
    await new Promise(r => setTimeout(r, 5000));

    // Verifica se o DNS já existe na tabela para não duplicar
    const existe = await page.evaluate((m3u) => {
      return document.body.innerText.includes(m3u);
    }, pedido.m3u);

    if (existe) {
      console.log("DNS já cadastrado, pulando...");
      pedido.status = "ok";
      return;
    }

    // ADICIONAR
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
      await new Promise(r => setTimeout(r, 6000));
      
      pedido.status = "ok";
      console.log("FINALIZADO COM SUCESSO:", pedido.m3u);
    }
  } catch (err) {
    console.log("ERRO NO BOT:", err.message);
    pedido.status = "erro";
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = executarBot;
