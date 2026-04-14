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

    // ======================
    // LOGIN (🔥 CORRIGIDO)
    // ======================
    await page.goto("https://iboplayer.pro/manage-playlists/login/");
    await page.waitForSelector("input", { timeout: 30000 });

    const inputsLogin = await page.$$("input");

    if (inputsLogin.length < 2) {
      throw new Error("Campos de login não encontrados");
    }

    // digita devagar (simula humano)
    await inputsLogin[0].type(process.env.IBO_USER, { delay: 100 });
    await inputsLogin[1].type(process.env.IBO_PASS, { delay: 100 });

    console.log("Preencheu login");

    // 🔥 ativa botão login
    await page.evaluate(() => {
      const btn = document.querySelector("button[type=submit]");
      if (btn) btn.disabled = false;
    });

    await sleep(2000);

    // clicar login
    await page.evaluate(() => {
      const btn = document.querySelector("button[type=submit]");
      if (btn) btn.click();
    });

    console.log("CLICOU LOGIN");

    await sleep(6000);

    console.log("LOGADO REAL");

    // ======================
    // IR PARA LISTA
    // ======================
    await page.goto("https://iboplayer.pro/manage-playlists/list/");
    await sleep(6000);

    // ======================
    // ADD PLAYLIST
    // ======================
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button"))
        .find(el => el.innerText.includes("Add Playlist"));
      if (btn) btn.click();
    });

    await sleep(5000);

    const inputs = await page.$$("input");

    if (inputs.length < 2) {
      throw new Error("Inputs não encontrados");
    }

    // nome
    await inputs[0].click({ clickCount: 3 });
    await inputs[0].type(pedido.nome);

    // url m3u
    await inputs[1].click({ clickCount: 3 });
    await inputs[1].type(pedido.m3u);

    console.log("Dados preenchidos");

    // ======================
    // 🔥 ATUALIZAÇÃO: GARANTIR PREENCHIMENTO (REACT)
    // ======================
    await page.evaluate(() => {
      const inputs = document.querySelectorAll("input");
      inputs.forEach(input => {
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      });
    });

    // ======================
    // 🔥 ATUALIZAÇÃO: SUBMIT CORRIGIDO
    // ======================
    const submitBtn = await page.$('button[type="submit"]');

    if (submitBtn) {
      await submitBtn.click();
      console.log("Clicou no botão submit");
    } else {
      console.log("Botão não encontrado, tentando ENTER");
      await page.keyboard.press("Enter");
    }

    // espera resposta
    await sleep(8000);

    pedido.status = "ok";
    console.log("SUCESSO:", pedido.mac);

    return;

  } catch (err) {
    pedido.status = "erro";
    console.log("ERRO:", err.message);
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (e) {}
    }
  }
}

module.exports = executarBot;
