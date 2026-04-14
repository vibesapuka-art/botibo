const puppeteer = require("puppeteer");

async function executarBot(pedidos) {
  const pendentes = pedidos.filter(p => p.status === "pendente").slice(0, 1);
  if (pendentes.length === 0) return;

  console.log("BOT iniciado...");

  let browser;

  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu"
      ]
    });

    const page = await browser.newPage();

    // LOGIN
    await page.goto("https://iboplayer.pro/manage-playlists/login/");
    await page.waitForSelector("input[name=mac]", { timeout: 20000 });

    await page.type("input[name=mac]", process.env.IBO_USER);
    await page.type("input[name=key]", process.env.IBO_PASS);

    await page.click("button[type=submit]");
    await page.waitForNavigation({ waitUntil: "networkidle2" });

    for (let p of pendentes) {
      try {
        console.log("Ativando:", p.mac);

        await page.goto("https://iboplayer.pro/manage-playlists/list/");
        await page.waitForTimeout(5000);

        // CLICAR ADD PLAYLIST
        const botoes = await page.$$("button");
        for (let btn of botoes) {
          const texto = await page.evaluate(el => el.innerText, btn);
          if (texto.includes("Add Playlist")) {
            await btn.click();
            break;
          }
        }

        await page.waitForTimeout(4000);

        // PEGAR INPUTS
        const inputs = await page.$$("input");

        await inputs[0].click({ clickCount: 3 });
        await inputs[0].type(p.nome);

        await inputs[1].click({ clickCount: 3 });
        await inputs[1].type(p.m3u);

        // SUBMIT
        const botoes2 = await page.$$("button");
        for (let btn of botoes2) {
          const texto = await page.evaluate(el => el.innerText, btn);
          if (texto.includes("SUBMIT")) {
            await btn.click();
            break;
          }
        }

        await page.waitForTimeout(5000);

        p.status = "ok";
        console.log("SUCESSO:", p.mac);

      } catch (err) {
        p.status = "erro";
        console.log("ERRO PEDIDO:", err.message);
      }
    }

  } catch (err) {
    console.log("ERRO GERAL:", err.message);
  }

  if (browser) await browser.close();
}

module.exports = executarBot;
