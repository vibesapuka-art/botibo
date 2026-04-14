const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function executarBot(pedidos) {
  // Pega apenas o primeiro da fila que ainda está pendente
  const pedido = pedidos.find(p => p.status === "pendente");

  if (!pedido) return;

  console.log("BOT iniciado para DNS:", pedido.m3u);
  let browser;

  try {
    browser = await puppeteer.launch({
      args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox"],
      executablePath: await chromium.executablePath(),
      headless: true
    });

    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(60000);

    // LOGIN
    await page.goto("https://iboplayer.pro/manage-playlists/login/", { waitUntil: "networkidle2" });
    await page.waitForSelector("input[name='mac_address']");

    await page.type("input[name='mac_address']", pedido.mac, { delay: 50 });
    await page.type("input[name='password']", pedido.key, { delay: 50 });

    await page.evaluate(() => {
      const btn = document.querySelector("button[type='submit']");
      if (btn) {
        btn.disabled = false;
        btn.click();
      }
    });

    await sleep(7000);

    // LISTA
    await page.goto("https://iboplayer.pro/manage-playlists/list/", { waitUntil: "networkidle2" });
    await sleep(5000);

    // CLICAR NO BOTÃO ADD
    const clicouAdd = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button"))
        .find(el => el.innerText.includes("Add Playlist"));
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });

    if (!clicouAdd) throw new Error("Botão Add Playlist não encontrado");
    await sleep(3000);

    // PREENCHER CAMPOS
    const inputs = await page.$$("input");
    if (inputs.length >= 2) {
      await inputs[0].type(pedido.nome, { delay: 50 });
      await inputs[1].type(pedido.m3u, { delay: 50 });

      // Forçar o site a reconhecer o texto
      await page.evaluate(() => {
        document.querySelectorAll("input").forEach(i => {
          i.dispatchEvent(new Event("input", { bubbles: true }));
          i.dispatchEvent(new Event("change", { bubbles: true }));
        });
      });

      await sleep(2000);
      await page.keyboard.press("Enter");
      await sleep(6000);

      pedido.status = "ok";
      console.log("SUCESSO NO DNS:", pedido.m3u);
    }

  } catch (err) {
    pedido.status = "erro";
    console.log("FALHA NO DNS:", pedido.m3u, "ERRO:", err.message);
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = executarBot;
