const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function executarBot(pedidos) {
  const pedido = pedidos.find(p => p.status === "pendente" || p.status === "processando");
  if (!pedido) return;

  const PIN_PADRAO = "123321";
  pedido.status = "processando";

  console.log("BOT iniciado para MAC:", pedido.mac);
  let browser;

  try {
    // 🔥 CORREÇÃO AQUI: executablePath (CamelCase) e await chromium.executablePath()
    browser = await puppeteer.launch({
      args: [
        ...chromium.args, 
        "--no-sandbox", 
        "--disable-setuid-sandbox", 
        "--disable-dev-shm-usage", 
        "--single-process"
      ],
      executablePath: await chromium.executablePath(), // Corrigido de executable_path para executablePath
      headless: true
    });

    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(60000);

    // LOGIN
    await page.goto("https://iboplayer.pro/manage-playlists/login/");
    const inputsLogin = await page.$$("input");
    if (inputsLogin.length >= 2) {
        await inputsLogin[0].type(process.env.IBO_USER, { delay: 100 });
        await inputsLogin[1].type(process.env.IBO_PASS, { delay: 100 });
        await page.evaluate(() => document.querySelector("button[type=submit]").click());
    }
    await sleep(8000);

    // LISTA E VERIFICAÇÃO
    await page.goto("https://iboplayer.pro/manage-playlists/list/");
    await sleep(5000);
    const existe = await page.evaluate(m => document.body.innerText.includes(m), pedido.m3u);
    
    if (existe) {
      console.log("DNS já cadastrado no site.");
      pedido.status = "ok";
      return;
    }

    // ADICIONAR PLAYLIST
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find(el => el.innerText.includes("Add Playlist"));
      if (btn) btn.click();
    });
    await sleep(4000);

    // PREENCHER NOME E URL
    const inputs = await page.$$("input");
    await inputs[0].type(pedido.nome, { delay: 50 });
    await inputs[1].type(pedido.m3u, { delay: 50 });

    // ATIVAR PIN
    console.log("Ativando PIN...");
    await page.evaluate(() => {
      const check = document.querySelector('input[type="checkbox"]');
      if (check) check.click();
    });
    await sleep(2000);

    // PREENCHER PIN (3) e CONFIRMAR (4)
    const todosInputs = await page.$$("input");
    if (todosInputs.length >= 5) {
      await todosInputs[3].type(PIN_PADRAO, { delay: 100 });
      await todosInputs[4].type(PIN_PADRAO, { delay: 100 });
    }

    // SUBMIT
    const submitBtn = await page.$('button[type="submit"]');
    if (submitBtn) await submitBtn.click();
    else await page.keyboard.press("Enter");

    await sleep(15000);

    // VERIFICAÇÃO FINAL
    await page.goto("https://iboplayer.pro/manage-playlists/list/");
    const salvo = await page.evaluate(m => document.body.innerText.includes(m), pedido.m3u);

    if (salvo) {
      pedido.status = "ok";
      console.log("SUCESSO CONFIRMADO:", pedido.mac);
    } else {
      throw new Error("Não apareceu na lista após salvar");
    }

  } catch (err) {
    console.log("ERRO NO PROCESSO:", err.message);
    pedido.status = "pendente"; 
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = executarBot;
