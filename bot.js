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
      args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox", "--single-process"],
      executablePath: await chromium.executablePath(),
      headless: true
    });

    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(45000); // Timeout para o Render lento

    // 1. LOGIN
    await page.goto("https://iboplayer.pro/manage-playlists/login/", { waitUntil: "networkidle2" });
    await page.type("input[name='mac_address']", pedido.mac);
    await page.type("input[name='password']", pedido.key);
    await page.click("button[type='submit']");
    
    // Aguarda resposta do servidor (Painel IBO é lento)
    await new Promise(r => setTimeout(r, 8000));

    // VERIFICAÇÃO DE LOGIN: Se ainda houver input de MAC, o login falhou
    const loginInvalido = await page.evaluate(() => {
      return document.body.innerText.includes("Invalid request") || 
             document.querySelector("input[name='mac_address']") !== null;
    });

    if (loginInvalido) {
      console.log(`[ERRO] Login falhou para MAC: ${pedido.mac}`);
      pedido.status = "erro_login"; 
      return; 
    }

    console.log(`[OK] Login realizado. Iniciando playlists para ${pedido.mac}`);

    // 2. ADICIONAR PLAYLISTS (Exemplo de fluxo para 1 playlist baseada no DNS)
    let nomePlaylist = pedido.m3u.replace(/(^\w+:|^)\/\//, '').split('.')[0].toUpperCase();
    
    await page.goto("https://iboplayer.pro/manage-playlists/list/", { waitUntil: "networkidle2" });
    
    // Verifica se já existe para evitar duplicado
    const existe = await page.evaluate(n => document.body.innerText.toUpperCase().includes(n), nomePlaylist);
    
    if (!existe) {
      const btnAdd = await page.evaluateHandle(() => Array.from(document.querySelectorAll("button")).find(el => el.innerText.includes("Add Playlist")));
      if (btnAdd) await btnAdd.click();
      await new Promise(r => setTimeout(r, 3000));

      const inputs = await page.$$("input");
      if (inputs.length >= 2) {
        await inputs[0].type(nomePlaylist);
        await inputs[1].type(pedido.m3u);
        
        // Ativa PIN
        await page.evaluate(() => {
          const c = document.querySelector('input[type="checkbox"]');
          if (c) c.click();
        });
        await new Promise(r => setTimeout(r, 2000));

        const pins = await page.$$("input");
        if (pins.length >= 5) {
          await pins[3].type(PIN_PADRAO);
          await pins[4].type(PIN_PADRAO);
        }
        await page.evaluate(() => document.querySelector('button[type="submit"]').click());
        await new Promise(r => setTimeout(r, 10000));
      }
    }

    pedido.status = "ok";

  } catch (err) {
    console.log("FALHA NO BOT:", err.message);
    pedido.status = "pendente"; // Tenta novamente se cair o servidor
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = { executarBot };
