const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

async function executarBot(pedidos) {
  const pendentes = pedidos.filter(p => p.status === "pendente").slice(0, 1);
  if (pendentes.length === 0) return;

  console.log("BOT iniciado...");

  let browser;

  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless
    });

    const page = await browser.newPage();

    // ======================
    // LOGIN
    // ======================
    await page.goto("https://iboplayer.pro/manage-playlists/login/", {
      waitUntil: "networkidle2"
    });

    await page.waitForSelector("input", { timeout: 30000 });

    const inputsLogin = await page.$$("input");

    if (inputsLogin.length < 2) {
      throw new Error("Campos de login não encontrados");
    }

    await inputsLogin[0].type(process.env.IBO_USER);
    await inputsLogin[1].type(process.env.IBO_PASS);

    console.log("Preencheu login");

    // clicar login
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button"))
        .find(el => el.innerText.toLowerCase().includes("login"));
      if (btn) btn.click();
    });

    // 🔥 NÃO USA MAIS waitForNavigation (corrigido)
    await Promise.race([
      page.waitForSelector("button", { timeout: 15000 }),
      page.waitForTimeout(8000)
    ]);

    console.log("LOGADO (sem travar)");

    // ======================
    // PROCESSAR PEDIDOS
    // ======================
    for (let p of pendentes) {
      try {
        console.log("Ativando:", p.mac);

        await page.goto("https://iboplayer.pro/manage-playlists/list/");
        await page.waitForTimeout(6000);

        // clicar Add Playlist
        await page.evaluate(() => {
          const btn = Array.from(document.querySelectorAll("button"))
            .find(el => el.innerText.includes("Add Playlist"));
          if (btn) btn.click();
        });

        await page.waitForTimeout(5000);

        const inputs = await page.$$("input");

        if (inputs.length < 2) {
          throw new Error("Inputs não encontrados");
        }

        await inputs[0].click({ clickCount: 3 });
        await inputs[0].type(p.nome);

        await inputs[1].click({ clickCount: 3 });
        await inputs[1].type(p.m3u);

        console.log("Dados preenchidos");

        // clicar submit
        await page.evaluate(() => {
          const btn = Array.from(document.querySelectorAll("button"))
            .find(el => el.innerText.includes("SUBMIT"));
          if (btn) btn.click();
        });

        await page.waitForTimeout(6000);

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
