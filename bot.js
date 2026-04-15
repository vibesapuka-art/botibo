const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function executarBot(pedidos) {
  // Encontra o primeiro pedido que precise de ser processado
  const pedido = pedidos.find(p => p.status === "pendente" || p.status === "processando");
  if (!pedido) return;

  const PIN_PADRAO = "123321";
  pedido.status = "processando";

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

    // 1. LOGIN
    await page.goto("https://iboplayer.pro/manage-playlists/login/");
    await page.waitForSelector("input", { timeout: 30000 });
    const inputsLogin = await page.$$("input");
    
    if (inputsLogin.length >= 2) {
      await inputsLogin[0].type(process.env.IBO_USER, { delay: 100 });
      await inputsLogin[1].type(process.env.IBO_PASS, { delay: 100 });
      await page.evaluate(() => document.querySelector("button[type=submit]").click());
    }
    await sleep(8000);

    // 2. IR PARA A LISTA E VERIFICAR SE JÁ EXISTE
    await page.goto("https://iboplayer.pro/manage-playlists/list/");
    await sleep(5000);
    const existe = await page.evaluate(m => document.body.innerText.includes(m), pedido.m3u);
    
    if (existe) {
      console.log("DNS já cadastrado no site. A saltar...");
      pedido.status = "ok";
      return;
    }

    // 3. CLICAR EM ADD PLAYLIST
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find(el => el.innerText.includes("Add Playlist"));
      if (btn) btn.click();
    });
    await sleep(5000);

    // 4. PREENCHER NOME E URL
    const inputs = await page.$$("input");
    await inputs[0].type(pedido.nome, { delay: 50 });
    await inputs[1].type(pedido.m3u, { delay: 50 });

    // 5. ATIVAR PROTEÇÃO POR PIN
    console.log("A ativar checkbox de proteção...");
    await page.evaluate(() => {
      const check = document.querySelector('input[type="checkbox"]');
      if (check) check.click();
    });
    await sleep(3000);

    // 6. PREENCHER PIN E CONFIRMAR PIN (Campos 3 e 4)
    const todosInputs = await page.$$("input");
    if (todosInputs.length >= 5) {
      await todosInputs[3].type(PIN_PADRAO, { delay: 100 });
      await todosInputs[4].type(PIN_PADRAO, { delay: 100 });
      console.log("PINs preenchidos.");
    }

    // 7. FORÇAR RECONHECIMENTO (REACT)
    await page.evaluate(() => {
      document.querySelectorAll("input").forEach(i => {
        i.dispatchEvent(new Event("input", { bubbles: true }));
        i.dispatchEvent(new Event("change", { bubbles: true }));
        i.blur();
      });
    });
    await sleep(2000);

    // 8. SUBMIT
    const submitBtn = await page.$('button[type="submit"]');
    if (submitBtn) await submitBtn.click();
    else await page.keyboard.press("Enter");

    console.log("Comando enviado. A aguardar processamento do site...");
    await sleep(15000);

    // 9. VERIFICAÇÃO FINAL NA LISTA
    await page.goto("https://iboplayer.pro/manage-playlists/list/", { waitUntil: "networkidle2" });
    const salvo = await page.evaluate(m => document.body.innerText.includes(m), pedido.m3u);

    if (salvo) {
      pedido.status = "ok";
      console.log("SUCESSO: Playlist confirmada na listagem!");
    } else {
      throw new Error("O site não confirmou a criação da playlist.");
    }

  } catch (err) {
    console.log("ERRO NO PROCESSO:", err.message);
    pedido.status = "pendente"; // Tenta novamente no próximo ciclo
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = executarBot;
