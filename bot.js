const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function executarBot(pedidos) {
  const pendentes = pedidos.filter(p => p.status === "pendente");
  if (pendentes.length === 0) return;

  const pedido = pendentes[0];
  const PIN_PADRAO = "1234554321"; 

  console.log("BOT iniciado... Ativando:", pedido.mac);
  let browser;

  try {
    browser = await puppeteer.launch({
      args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
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

    // IR PARA LISTA
    await page.goto("https://iboplayer.pro/manage-playlists/list/", { waitUntil: "networkidle2" });
    await sleep(5000);

    // CLICAR ADD
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find(el => el.innerText.includes("Add Playlist"));
      if (btn) btn.click();
    });
    await sleep(4000);

    // PREENCHER NOME E M3U
    const inputs = await page.$$("input");
    await inputs[0].click({ clickCount: 3 });
    await inputs[0].type(pedido.nome, { delay: 50 });
    await inputs[1].click({ clickCount: 3 });
    await inputs[1].type(pedido.m3u, { delay: 50 });

    // ATIVAR PROTEÇÃO
    console.log("Configurando proteção por PIN...");
    await page.evaluate(() => {
      const checkbox = document.querySelector('input[type="checkbox"]');
      if (checkbox) checkbox.click();
    });
    await sleep(3000);

    // PREENCHER PINs (campos 3 e 4 que surgem no formulário)
    const todosInputs = await page.$$("input");
    if (todosInputs.length >= 5) {
      await todosInputs[3].type(PIN_PADRAO, { delay: 50 });
      await todosInputs[4].type(PIN_PADRAO, { delay: 50 });
    }

    // 🔥 FORÇAR RECONHECIMENTO DO REACT (Crucial para não salvar vazio)
    await page.evaluate(() => {
      const campos = document.querySelectorAll("input");
      campos.forEach(input => {
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        input.blur(); // Tira o foco para garantir o registro do valor
      });
    });
    await sleep(2000);

    // SUBMIT (Tentar clique direto e depois Enter se falhar)
    const clicou = await page.evaluate(() => {
      const btn = document.querySelector('button[type="submit"]');
      if (btn && !btn.disabled) {
        btn.click();
        return true;
      }
      return false;
    });

    if (!clicou) {
      await page.keyboard.press("Enter");
    }

    console.log("Submit enviado, aguardando confirmação do site...");
    
    // 🔥 VERIFICAÇÃO FINAL: Esperar o modal fechar ou a lista atualizar
    await sleep(10000); 
    
    // Verifica se o DNS agora aparece na página
    const salvo = await page.evaluate((url) => document.body.innerText.includes(url), pedido.m3u);

    if (salvo) {
      pedido.status = "ok";
      console.log("SUCESSO CONFIRMADO NA TELA:", pedido.mac);
    } else {
      throw new Error("O site não confirmou a criação da playlist na listagem.");
    }

  } catch (err) {
    pedido.status = "erro";
    console.log("FALHA NO PROCESSO:", err.message);
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = executarBot;
