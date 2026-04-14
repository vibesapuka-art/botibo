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
  const PIN_PADRAO = "1234554321"; // Senha padrão solicitada

  console.log("BOT iniciado...");
  console.log("Ativando:", pedido.mac);

  let browser;

  try {
    browser = await puppeteer.launch({
      args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      executablePath: await chromium.executablePath(),
      headless: true
    });

    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(60000);

    // ======================
    // LOGIN
    // ======================
    await page.goto("https://iboplayer.pro/manage-playlists/login/");
    await page.waitForSelector("input", { timeout: 30000 });

    const inputsLogin = await page.$$("input");
    await inputsLogin[0].type(process.env.IBO_USER, { delay: 100 });
    await inputsLogin[1].type(process.env.IBO_PASS, { delay: 100 });

    await page.evaluate(() => {
      const btn = document.querySelector("button[type=submit]");
      if (btn) btn.disabled = false;
    });

    await sleep(2000);
    await page.evaluate(() => {
      const btn = document.querySelector("button[type=submit]");
      if (btn) btn.click();
    });

    await sleep(6000);

    // ======================
    // IR PARA LISTA E ADICIONAR
    // ======================
    await page.goto("https://iboplayer.pro/manage-playlists/list/");
    await sleep(6000);

    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button"))
        .find(el => el.innerText.includes("Add Playlist"));
      if (btn) btn.click();
    });

    await sleep(5000);

    const inputs = await page.$$("input");

    // Nome e URL (Posições 0 e 1 baseadas no seu bot.js anterior)
    await inputs[0].type(pedido.nome, { delay: 50 });
    await inputs[1].type(pedido.m3u, { delay: 50 });

    // ======================
    // 🔥 NOVA PROTEÇÃO COM PIN
    // ======================
    console.log("Configurando proteção por PIN...");

    // Clica no checkbox "Protect this playlist"
    await page.evaluate(() => {
      const checkbox = document.querySelector('input[type="checkbox"]');
      if (checkbox) checkbox.click();
    });

    await sleep(2000);

    // Após o click no checkbox, novos campos de input aparecem para o PIN
    // Vamos localizar os campos de PIN e Confirm PIN
    const todosInputs = await page.$$("input");
    
    // O formulário agora tem: Name (0), URL (1), Checkbox (2), PIN (3), Confirm PIN (4)
    if (todosInputs.length >= 5) {
      await todosInputs[3].type(PIN_PADRAO, { delay: 50 });
      await todosInputs[4].type(PIN_PADRAO, { delay: 50 });
      console.log("PIN preenchido");
    }

    // Garantir que o React reconheça as mudanças
    await page.evaluate(() => {
      const campos = document.querySelectorAll("input");
      campos.forEach(input => {
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      });
    });

    // ======================
    // SUBMIT
    // ======================
    const submitBtn = await page.$('button[type="submit"]');
    if (submitBtn) {
      await submitBtn.click();
      console.log("Clicou no botão submit");
    } else {
      await page.keyboard.press("Enter");
    }

    await sleep(8000);

    pedido.status = "ok";
    console.log("SUCESSO:", pedido.mac);

  } catch (err) {
    pedido.status = "erro";
    console.log("ERRO:", err.message);
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = executarBot;
