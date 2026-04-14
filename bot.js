const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

async function executarBot(pedidos) {
  const pedido = pedidos.find(p => p.status === "pendente" || p.status === "processando");
  if (!pedido) return;

  pedido.status = "processando";
  const PIN_PADRAO = "123321"; // Seu PIN de 6 dígitos

  console.log("PROCESSANDO DNS:", pedido.m3u);

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
    await page.goto("https://iboplayer.pro/manage-playlists/login/", { waitUntil: "networkidle2" });
    await page.type("input[name='mac_address']", pedido.mac);
    await page.type("input[name='password']", pedido.key);
    
    await page.evaluate(() => {
      const btn = document.querySelector("button[type='submit']");
      if (btn) { btn.disabled = false; btn.click(); }
    });
    await new Promise(r => setTimeout(r, 8000));

    // 2. LISTA E VERIFICAÇÃO
    await page.goto("https://iboplayer.pro/manage-playlists/list/", { waitUntil: "networkidle2" });
    const existe = await page.evaluate(m => document.body.innerText.includes(m), pedido.m3u);
    if (existe) {
      console.log("DNS já cadastrado.");
      pedido.status = "ok";
      return;
    }

    // 3. CLICAR EM ADD PLAYLIST
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find(el => el.innerText.includes("Add Playlist"));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 4000));

    // 4. PREENCHER DADOS BÁSICOS
    const inputs = await page.$$("input");
    if (inputs.length >= 2) {
      await inputs[0].type(pedido.nome, { delay: 50 });
      await inputs[1].type(pedido.m3u, { delay: 50 });

      // 5. ATIVAR O PIN (PROTECT THIS PLAYLIST)
      console.log("Ativando proteção por PIN...");
      await page.evaluate(() => {
        const check = document.querySelector('input[type="checkbox"]');
        if (check) check.click();
      });
      await new Promise(r => setTimeout(r, 2000));

      // 6. PREENCHER PIN E CONFIRMAÇÃO
      // Após o checkbox, novos inputs aparecem no formulário
      const todosInputs = await page.$$("input");
      if (todosInputs.length >= 5) {
        // Campo PIN (index 3) e Confirm PIN (index 4)
        await todosInputs[3].type(PIN_PADRAO, { delay: 100 });
        await todosInputs[4].type(PIN_PADRAO, { delay: 100 });
        console.log("PINs preenchidos.");
      }

      // 7. FINALIZAR (SUBMIT)
      await page.evaluate(() => {
        const btn = document.querySelector('button[type="submit"]');
        if (btn) btn.click();
      });

      await new Promise(r => setTimeout(r, 10000));
      
      // Verificação final
      await page.goto("https://iboplayer.pro/manage-playlists/list/", { waitUntil: "networkidle2" });
      const salvo = await page.evaluate(m => document.body.innerText.includes(m), pedido.m3u);
      
      if (salvo) {
        pedido.status = "ok";
        console.log("SUCESSO TOTAL COM PIN NO DNS:", pedido.m3u);
      } else {
        throw new Error("Site não confirmou salvamento");
      }
    }

  } catch (err) {
    console.log("FALHA:", err.message);
    pedido.status = "pendente"; 
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = executarBot;
