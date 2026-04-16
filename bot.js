const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

async function executarBot(pedidos) {
  const pedido = pedidos.find(p => p.status === "pendente" || p.status === "processando");
  if (!pedido) return;

  pedido.status = "processando";
  const PIN_PADRAO = "123321";
  const NOSSAS_PLAYLISTS = ["XW", "MEUSRV", "PRD", "SOLAR", "ATBX", "ATN", "OD", "ECPS", "TITA", "VR766", "HADES", "IFX", "NTB", "FLASH", "OLYMPUS"];

  let browser;
  try {
    browser = await puppeteer.launch({
      args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox"],
      executablePath: await chromium.executablePath(),
      headless: true
    });

    const page = await browser.newPage();
    await page.goto("https://iboplayer.pro/manage-playlists/login/", { waitUntil: "networkidle2" });
    
    await page.type("input[name='mac_address']", pedido.mac);
    await page.type("input[name='password']", pedido.key);
    await page.click("button[type='submit']");
    await new Promise(r => setTimeout(r, 8000));

    if (page.url().includes("login")) {
      pedido.status = "erro_login";
      return;
    }

    // --- LIMPEZA SELETIVA MELHORADA ---
    if (pedido.limpar === true) {
      console.log(`[LIMPEZA] Verificando playlists para excluir...`);
      await page.goto("https://iboplayer.pro/manage-playlists/list/", { waitUntil: "networkidle2" });
      await new Promise(r => setTimeout(r, 4000));

      let encontrou = true;
      while (encontrou) {
        encontrou = await page.evaluate((nomes) => {
          const linhas = Array.from(document.querySelectorAll('tr'));
          for (let linha of linhas) {
            const textoLinha = linha.innerText.toUpperCase();
            // Verifica se a linha contém um dos nossos nomes
            const ehNossa = nomes.some(n => textoLinha.includes(n));
            const btnDelete = linha.querySelector('.delete_playlist');
            
            if (ehNossa && btnDelete) {
              btnDelete.click(); // Clica no botão amarelo de deletar
              return true;
            }
          }
          return false;
        }, NOSSAS_PLAYLISTS);

        if (encontrou) {
          await new Promise(r => setTimeout(r, 2000));
          const inputPin = await page.$('input[type="password"]');
          if (inputPin) {
            await inputPin.type(PIN_PADRAO);
            await page.keyboard.press('Enter');
          }
          await new Promise(r => setTimeout(r, 5000));
          await page.goto("https://iboplayer.pro/manage-playlists/list/", { waitUntil: "networkidle2" });
        }
      }
      console.log("[LIMPEZA] Faxina concluída.");
    }

    // --- ADICIONAR PLAYLIST ---
    await page.goto("https://iboplayer.pro/manage-playlists/list/", { waitUntil: "networkidle2" });
    const existe = await page.evaluate(nome => document.body.innerText.toUpperCase().includes(nome.toUpperCase()), pedido.nome);

    if (existe) {
      console.log(`[PULO] ${pedido.nome} já existe.`);
      pedido.status = "ok";
    } else {
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll("button")).find(el => el.innerText.includes("Add Playlist"));
        if (btn) btn.click();
      });
      await new Promise(r => setTimeout(r, 4000));
      const inputs = await page.$$("input");
      if (inputs.length >= 2) {
        await inputs[0].type(pedido.nome);
        await inputs[1].type(pedido.m3u);
        const check = await page.$('input[type="checkbox"]');
        if (check) await check.click();
        await new Promise(r => setTimeout(r, 1500));
        const pins = await page.$$('input[type="password"]');
        if (pins.length >= 2) {
           await pins[0].type(PIN_PADRAO);
           await pins[1].type(PIN_PADRAO);
        }
        await page.click('button[type="submit"]');
        await new Promise(r => setTimeout(r, 8000));
        pedido.status = "ok";
      }
    }
  } catch (err) {
    console.log("Erro:", err.message);
    pedido.status = "pendente";
  } finally {
    if (browser) await browser.close();
  }
}
module.exports = executarBot;
