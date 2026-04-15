const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function executarBot(pedidos) {
  // Pega o primeiro pedido que esteja pendente ou em processamento
  const pedido = pedidos.find(p => p.status === "pendente" || p.status === "processando");

  if (!pedido) {
    console.log("Nenhum pedido pendente na fila.");
    return;
  }

  const PIN_PADRAO = "123321";
  pedido.status = "processando";

  console.log("BOT iniciado para MAC:", pedido.mac);
  console.log("Processando DNS:", pedido.m3u);

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
    await page.waitForSelector("input", { timeout: 30000 });

    const inputsLogin = await page.$$("input");
    await inputsLogin[0].type(process.env.IBO_USER, { delay: 100 });
    await inputsLogin[1].type(process.env.IBO_PASS, { delay: 100 });

    await page.evaluate(() => {
      const btn = document.querySelector("button[type=submit]");
      if (btn) { btn.disabled = false; btn.click(); }
    });

    await sleep(8000);

    // LISTA E VERIFICAÇÃO DE DUPLICIDADE
    await page.goto("https://iboplayer.pro/manage-playlists/list/");
    await sleep(5000);

    const existe = await page.evaluate(m => document.body.innerText.includes(m), pedido.m3u);
    if (existe) {
      console.log("DNS já existe no site. Pulando...");
      pedido.status = "ok";
      return;
    }

    // CLICAR EM ADD PLAYLIST
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button"))
        .find(el => el.innerText.includes("Add Playlist"));
      if (btn) btn.click();
    });

    await sleep(5000);

    // PREENCHER NOME E URL
    const inputs = await page.$$("input");
    await inputs[0].click({ clickCount: 3 });
    await inputs[0].type(pedido.nome, { delay: 50 });
    await inputs[1].click({ clickCount: 3 });
    await inputs[1].type(pedido.m3u, { delay: 50 });

    // ATIVAR PROTEÇÃO POR PIN
    console.log("Configurando proteção por PIN...");
    await page.evaluate(() => {
      const check = document.querySelector('input[type="checkbox"]');
      if (check) check.click();
    });

    await sleep(3000);

    // PREENCHER PIN E CONFIRMAR PIN (Campos 3 e 4)
    const todosInputs = await page.$$("input");
    if (todosInputs.length >= 5) {
      await todosInputs[3].type(PIN_PADRAO, { delay: 100 });
      await todosInputs[4].type(PIN_PADRAO, { delay: 100 });
    }

    // GARANTIR QUE O REACT RECONHEÇA OS DADOS
    await page.evaluate(() => {
      document.querySelectorAll("input").forEach(i => {
        i.dispatchEvent(new Event("input", { bubbles: true }));
        i.dispatchEvent(new Event("change", { bubbles: true }));
        i.blur();
      });
    });

    await sleep(2000);

    // SUBMIT
    const submitBtn = await page.$('button[type="submit"]');
    if (submitBtn) {
      await submitBtn.click();
    } else {
      await page.keyboard.press("Enter");
    }

    console.log("Comando enviado. Aguardando processamento...");
    await sleep(10000);

    // SUCESSO: Marcamos como OK para remover da fila e não repetir
    pedido.status = "ok";
    console.log("SUCESSO NO CADASTRO:", pedido.m3u);

  } catch (err) {
    console.log("ERRO NO PROCESSO:", err.message);
    pedido.status = "pendente"; // Volta para a fila se falhar o navegador
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = executarBot;
