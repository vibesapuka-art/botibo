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

    // 1. LOGIN NO IBO PLAYER
    await page.goto("https://iboplayer.pro/manage-playlists/login/", { waitUntil: "networkidle2" });
    await page.type("input[name='mac_address']", pedido.mac);
    await page.type("input[name='password']", pedido.key);
    
    await page.evaluate(() => {
      const btn = document.querySelector("button[type='submit']");
      if (btn) { btn.disabled = false; btn.click(); }
    });

    await new Promise(r => setTimeout(r, 8000));

    // VERIFICA SE O LOGIN DEU CERTO
    const urlAtual = page.url();
    if (urlAtual.includes("login")) {
      console.log(`[ERRO] Login falhou para o MAC: ${pedido.mac}`);
      pedido.status = "erro_login";
      return;
    }

    // 2. LOGICA DE LIMPEZA TOTAL (Se o pedido tiver a marca 'limpar')
    if (pedido.limpar === true) {
      console.log(`[LIMPEZA] Iniciando faxina no MAC: ${pedido.mac}`);
      await page.goto("https://iboplayer.pro/manage-playlists/list/", { waitUntil: "networkidle2" });
      
      let temBotaoDelete = await page.$('.fa-trash-alt');

      while (temBotaoDelete) {
        console.log("[LIMPEZA] Apagando playlist encontrada...");
        
        await page.evaluate(() => {
          const lixeira = document.querySelector('.fa-trash-alt');
          if (lixeira) lixeira.parentElement.click(); 
        });

        await new Promise(r => setTimeout(r, 2000));

        // Digita o PIN de confirmação
        const inputPin = await page.$('input[type="password"]');
        if (inputPin) {
          await inputPin.type(PIN_PADRAO);
          await page.keyboard.press('Enter');
        }

        await new Promise(r => setTimeout(r, 4500));
        await page.goto("https://iboplayer.pro/manage-playlists/list/", { waitUntil: "networkidle2" });
        temBotaoDelete = await page.$('.fa-trash-alt');
      }
      console.log("[LIMPEZA] Painel limpo com sucesso!");
    }

    // 3. VERIFICA SE JÁ EXISTE (Evita duplicar se for "apenas ativar")
    await page.goto("https://iboplayer.pro/manage-playlists/list/", { waitUntil: "networkidle2" });
    const existe = await page.evaluate(nome => {
      return document.body.innerText.toUpperCase().includes(nome.toUpperCase());
    }, pedido.nome);

    if (existe) {
      console.log(`[PULO] ${pedido.nome} já está lá.`);
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

      // Ativar proteção por PIN
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
      console.log(`[SUCESSO] Playlist ${pedido.nome} adicionada.`);
    }

  } catch (err) {
    console.log("[ERRO NO BOT]:", err.message);
    pedido.status = "pendente"; // Tenta novamente no próximo ciclo
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = executarBot;
