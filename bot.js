const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

async function executarBot(pedidos) {
  const pedido = pedidos.find(p => p.status === "pendente" || p.status === "processando");
  if (!pedido) return;

  pedido.status = "processando";
  const PIN_PADRAO = "123321";

  let browser;
  try {
    browser = await puppeteer.launch({
      args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--single-process"],
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

    // VERIFICA SE O LOGIN FALHOU
    const logado = await page.url().includes("manage-playlists/list/");
    if (!logado) {
      console.log(`[ERRO] Login inválido: ${pedido.mac}`);
      pedido.status = "erro_login";
      return;
    }

    // 2. FUNÇÃO DE LIMPEZA (Só executa se solicitado no primeiro item da fila)
    if (pedido.limpar === true) {
        console.log("[LIMPEZA] Removendo playlists existentes...");
        let botoesDelete = await page.$$('.fa-trash-alt');
        
        while (botoesDelete.length > 0) {
            await botoesDelete[0].click();
            await new Promise(r => setTimeout(r, 2000));
            const inputPin = await page.$('input[type="password"]');
            if (inputPin) {
                await inputPin.type(PIN_PADRAO);
                await page.keyboard.press('Enter');
            }
            await new Promise(r => setTimeout(r, 3000));
            await page.goto("https://iboplayer.pro/manage-playlists/list/");
            botoesDelete = await page.$$('.fa-trash-alt');
        }
    }

    // 3. VERIFICA SE JÁ EXISTE (Para não duplicar)
    const existe = await page.evaluate(nome => {
      return document.body.innerText.toUpperCase().includes(nome.toUpperCase());
    }, pedido.nome);

    if (existe) {
      console.log(`[PULO] ${pedido.nome} já cadastrada.`);
      pedido.status = "ok";
      return;
    }

    // 4. ADICIONAR NOVA PLAYLIST
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find(el => el.innerText.includes("Add Playlist"));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 4000));

    const inputs = await page.$$("input");
    if (inputs.length >= 2) {
      await inputs[0].type(pedido.nome);
      await inputs[1].type(pedido.m3u);

      // Ativar PIN de Proteção
      await page.evaluate(() => {
        const check = document.querySelector('input[type="checkbox"]');
        if (check) check.click();
      });
      await new Promise(r => setTimeout(r, 2000));

      const todosInputs = await page.$$("input");
      if (todosInputs.length >= 5) {
        await todosInputs[3].type(PIN_PADRAO);
        await todosInputs[4].type(PIN_PADRAO);
      }

      await page.evaluate(() => {
        const btn = document.querySelector('button[type="submit"]');
        if (btn) btn.click();
      });

      await new Promise(r => setTimeout(r, 10000));
      pedido.status = "ok";
      console.log(`[SUCESSO] Adicionado: ${pedido.nome}`);
    }

  } catch (err) {
    console.log("[ERRO]:", err.message);
    pedido.status = "pendente"; 
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = executarBot;
