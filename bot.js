const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

async function executarBot(pedidos) {
  const pedido = pedidos.find(p => p.status === "pendente" || p.status === "processando");
  if (!pedido) return;

  pedido.status = "processando";
  const PIN_PADRAO = "123321";
  
  let nomePlaylist = "IPTV"; 
  try {
    nomePlaylist = pedido.m3u.replace(/(^\w+:|^)\/\//, '').split('.')[0].toUpperCase();
  } catch (e) { nomePlaylist = "LISTA"; }

  let browser;
  try {
    browser = await puppeteer.launch({
      args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--single-process"],
      executablePath: await chromium.executablePath(),
      headless: true
    });

    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(60000);

    // 1. LOGIN
    await page.goto("https://iboplayer.pro/manage-playlists/login/", { waitUntil: "networkidle2" });
    await page.type("input[name='mac_address']", pedido.mac);
    await page.type("input[name='password']", pedido.key);
    await page.click("button[type='submit']");
    
    await new Promise(r => setTimeout(r, 8000));

    // VERIFICAÇÃO DE LOGIN
    const loginInvalido = await page.evaluate(() => {
      return document.body.innerText.includes("Invalid request") || 
             document.querySelector("input[name='mac_address']") !== null;
    });

    if (loginInvalido) {
      console.log(`[ERRO] MAC/Key Incorretos: ${pedido.mac}`);
      pedido.status = "erro_login"; 
      return; 
    }

    // 2. CRIAÇÃO (Se login OK)
    await page.goto("https://iboplayer.pro/manage-playlists/list/", { waitUntil: "networkidle2" });
    
    // Lógica para adicionar (Add Playlist)
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find(el => el.innerText.includes("Add Playlist"));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 4000));

    const inputs = await page.$$("input");
    if (inputs.length >= 2) {
      await inputs[0].type(nomePlaylist);
      await inputs[1].type(pedido.m3u);

      await page.evaluate(() => document.querySelector('input[type="checkbox"]')?.click());
      await new Promise(r => setTimeout(r, 2000));

      const pins = await page.$$("input");
      if (pins.length >= 5) {
        await pins[3].type(PIN_PADRAO);
        await pins[4].type(PIN_PADRAO);
      }

      await page.evaluate(() => document.querySelector('button[type="submit"]').click());
      await new Promise(r => setTimeout(r, 10000));
      pedido.status = "ok";
    }

  } catch (err) {
    console.log("[ERRO BOT]:", err.message);
    pedido.status = "pendente"; 
  } finally {
    if (browser) await browser.close();
  }
}

// Exportação correta para o index.js
module.exports = executarBot;
