const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function executarBot(pedidos) {
  const pendentes = pedidos.filter(p => p.status === "pendente");

  if (pendentes.length === 0) return;

  const pedido = pendentes[0];
  console.log("BOT iniciado...");
  console.log("Ativando:", pedido.mac);

  let browser;

  try {
    browser = await puppeteer.launch({
      args: [...chromium.args, "--hide-scrollbars", "--disable-web-security"],
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: true,
    });

    const page = await browser.newPage();
    
    // 1. LOGIN
    await page.goto("https://iboplayer.pro/manage-playlists/login/", { waitUntil: "networkidle2" });
    
    // Espera os campos específicos do HTML que você mandou
    await page.waitForSelector("input[name='mac_address']");
    
    // Preenche MAC e KEY (Device Key)
    await page.type("input[name='mac_address']", pedido.mac, { delay: 100 });
    await page.type("input[name='password']", pedido.key, { delay: 100 });

    // Habilita o botão que estava "disabled" no seu HTML
    await page.evaluate(() => {
      const btn = document.querySelector("button[type='submit']");
      if (btn) {
        btn.disabled = false;
        btn.click();
      }
    });

    console.log("Preencheu login e clicou");
    await sleep(8000); // Espera o login processar

    // 2. IR PARA LISTA
    await page.goto("https://iboplayer.pro/manage-playlists/list/", { waitUntil: "networkidle2" });
    await sleep(4000);

    // 3. CLICAR EM ADD PLAYLIST
    const addBtn = await page.evaluateHandle(() => {
      return Array.from(document.querySelectorAll("button")).find(el => el.innerText.includes("Add Playlist"));
    });

    if (addBtn) {
      await addBtn.asElement().click();
      await sleep(3000);
    }

    // 4. PREENCHER DADOS DA PLAYLIST
    const inputs = await page.$$("input");
    if (inputs.length >= 2) {
      // Nome da Playlist
      await inputs[0].type(pedido.nome, { delay: 50 });
      // URL M3U
      await inputs[1].type(pedido.m3u, { delay: 50 });
      
      console.log("Dados da playlist preenchidos");

      // Força o React a entender que houve digitação
      await page.evaluate(() => {
        const fields = document.querySelectorAll("input");
        fields.forEach(f => {
          f.dispatchEvent(new Event("input", { bubbles: true }));
          f.dispatchEvent(new Event("change", { bubbles: true }));
        });
      });

      // 5. SALVAR (SUBMIT)
      await page.keyboard.press("Enter");
      await sleep(5000);
      
      console.log("SUCESSO:", pedido.mac);
      pedido.status = "ok";
    } else {
      throw new Error("Campos de playlist não encontrados");
    }

  } catch (err) {
    pedido.status = "erro";
    console.log("ERRO GERAL:", err.message);
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = executarBot;
