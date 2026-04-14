const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function executarBot(pedidos) {
  const pendentes = pedidos.filter(p => p.status === "pendente");

  if (pendentes.length === 0) {
    console.log("Nenhum pedido pendente");
    return;
  }

  const pedido = pendentes[0];

  console.log("BOT iniciado...");
  console.log("Ativando:", pedido.mac);

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
    await page.waitForSelector("input", { timeout: 30000 });

    const inputsLogin = await page.$$("input");

    if (inputsLogin.length < 2) {
      throw new Error("Campos de login não encontrados");
    }

    await inputsLogin[0].type(process.env.IBO_USER);
    await inputsLogin[1].type(process.env.IBO_PASS);

    console.log("Preencheu login");

    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button"))
        .find(el => el.innerText.toLowerCase().includes("login"));
      if (btn) btn.click();
    });

    await sleep(5000);

    console.log("LOGADO");

    // IR PRA LISTA
    await page.goto("https://iboplayer.pro/manage-playlists/list/");
    await sleep(6000);

    // ADD PLAYLIST
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button"))
        .find(el => el.innerText.includes("Add Playlist"));
      if (btn) btn.click();
    });

    await sleep(4000);

    const inputs = await page.$$("input");

    if (inputs.length < 2) {
      throw new Error("Inputs não encontrados");
    }

    await inputs[0].click({ clickCount: 3 });
    await inputs[0].type(pedido.nome);

    await inputs[1].click({ clickCount: 3 });
    await inputs[1].type(pedido.m3u);

    console.log("Dados preenchidos");

    // SUBMIT
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button"))
        .find(el => el.innerText.includes("SUBMIT"));
      if (btn) btn.click();
    });

    await sleep(6000);

    pedido.status = "ok";
    console.log("SUCESSO:", pedido.mac);

    return;

  } catch (err) {
    pedido.status = "erro";
    console.log("ERRO:", err.message);
  }

  if (browser) {
    try {
      await browser.close();
    } catch (e) {}
  }
}

module.exports = executarBot;
