const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function executarBot(pedidos) {
  // Localiza o pedido que já foi marcado como "processando" pelo index.js
  const pedido = pedidos.find(p => p.status === "processando");
  if (!pedido) return;

  const PIN_PADRAO = "123321";
  console.log("BOT iniciado para MAC:", pedido.mac);

  let browser;
  try {
    browser = await puppeteer.launch({
      args: [
        ...chromium.args,
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--single-process"
      ],
      executablePath: await chromium.executablePath(),
      headless: true
    });

    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(60000);

    // LOGIN
    await page.goto("https://iboplayer.pro/manage-playlists/login/");
    const inputsLogin = await page.$$("input");
    if (inputsLogin.length >= 2) {
      await inputsLogin[0].type(process.env.IBO_USER || pedido.mac, { delay: 100 });
      await inputsLogin[1].type(process.env.IBO_PASS || pedido.key, { delay: 100 });
      await page.evaluate(() => document.querySelector("button[type=submit]").click());
    }
    await sleep(8000);

    // NAVEGAR PARA LISTA
    await page.goto("https://iboplayer.pro/manage-playlists/list/");
    await sleep(5000);

    // CLICAR EM ADD PLAYLIST
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find(el => el.innerText.includes("Add Playlist"));
      if (btn) btn.click();
    });
    await sleep(4000);

    // PREENCHER NOME E URL
    const inputs = await page.$$("input");
    await inputs[0].type(pedido.nome, { delay: 50 });
    await inputs[1].type(pedido.m3u, { delay: 50 });

    // ATIVAR PROTEÇÃO POR PIN
    console.log("Configurando proteção por PIN...");
    await page.evaluate(() => {
      const check = document.querySelector('input[type="checkbox"]');
      if (check) check.click();
    });
    await sleep(3000);

    // PREENCHER PIN E CONFIRMAÇÃO (Campos 3 e 4)
    const todosInputs = await page.$$("input");
    if (todosInputs.length >= 5) {
      await todosInputs[3].type(PIN_PADRAO, { delay: 100 });
      await todosInputs[4].type(PIN_PADRAO, { delay: 100 });
    }

    // SUBMIT
    const submitBtn = await page.$('button[type="submit"]');
    if (submitBtn) {
      await submitBtn.click();
    } else {
      await page.keyboard.press("Enter");
    }

    // Espera o processamento do site antes de fechar
    await sleep(12000);

    // SUCESSO: Marca como ok para o index.js remover da fila
    pedido.status = "ok";
    console.log("SUCESSO NO CADASTRO:", pedido.mac);

  } catch (err) {
    console.log("ERRO NO PROCESSO:", err.message);
    pedido.status = "pendente"; // Em caso de erro, volta para a fila
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = executarBot;
