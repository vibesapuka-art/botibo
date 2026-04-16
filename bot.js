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
      args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox"],
      executablePath: await chromium.executablePath(),
      headless: true
    });

    const page = await browser.newPage();
    await page.goto("https://iboplayer.pro/manage-playlists/login/", { waitUntil: "networkidle2" });
    await page.type("input[name='mac_address']", pedido.mac);
    await page.type("input[name='password']", pedido.key);
    await page.click("button[type='submit']");
    await new Promise(r => setTimeout(r, 7000));

    if (page.url().includes("login")) {
      pedido.status = "erro_login";
      return;
    }

    await page.goto("https://iboplayer.pro/manage-playlists/list/", { waitUntil: "networkidle2" });

    if (pedido.acao === "EXCLUIR") {
      console.log(`[BOT] Tentando excluir: ${pedido.nome}`);
      
      const clicou = await page.evaluate((nomeAlvo) => {
        const rows = Array.from(document.querySelectorAll('tr'));
        for (let row of rows) {
          if (row.innerText.toUpperCase().includes(nomeAlvo)) {
            const btn = row.querySelector('.delete_playlist');
            if (btn) { btn.click(); return true; }
          }
        }
        return false;
      }, pedido.nome);

      if (clicou) {
        await new Promise(r => setTimeout(r, 2000));
        const pin = await page.$('input[type="password"]');
        if (pin) {
          await pin.type(PIN_PADRAO);
          await page.keyboard.press('Enter');
          await new Promise(r => setTimeout(r, 4000));
        }
      }
      pedido.status = "ok"; // Mesmo que não ache a lista (já foi apagada), marca como OK para seguir a fila

    } else {
      // LÓGICA DE ADICIONAR
      const existe = await page.evaluate(n => document.body.innerText.toUpperCase().includes(n), pedido.nome);
      if (existe) {
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
          await page.evaluate(() => document.querySelector('input[type="checkbox"]').click());
          await new Promise(r => setTimeout(r, 1500));
          const pins = await page.$$('input[type="password"]');
          if (pins.length >= 2) {
            await pins[0].type(PIN_PADRAO);
            await pins[1].type(PIN_PADRAO);
          }
          await page.click('button[type="submit"]');
          await new Promise(r => setTimeout(r, 7000));
        }
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
