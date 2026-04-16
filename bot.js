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

    if (page.url().includes("login")) {
      console.log(`[ERRO] Login falhou: ${pedido.mac}`);
      pedido.status = "erro_login";
      return;
    }

    // 2. LIMPEZA TOTAL (CORRIGIDA PARA O MODAL DAS FOTOS)
    if (pedido.limpar === true) {
      console.log(`[LIMPEZA] Iniciando faxina no MAC: ${pedido.mac}`);
      await page.goto("https://iboplayer.pro/manage-playlists/list/", { waitUntil: "networkidle2" });
      
      // Tenta encontrar o botão amarelo "Delete" que aparece na sua foto
      let temBotaoDelete = await page.$('.btn-warning.delete_playlist');

      while (temBotaoDelete) {
        console.log("[LIMPEZA] Clicando no botão Delete amarelo...");
        
        await page.click('.btn-warning.delete_playlist');
        
        // Espera o modal de PIN (da sua segunda foto) aparecer
        await new Promise(r => setTimeout(r, 2500));

        // Digita o PIN no campo que aparece no modal
        const inputsModal = await page.$$('input[type="password"]');
        for (let input of inputsModal) {
            const visivel = await input.boundingBox();
            if (visivel) {
                await input.type(PIN_PADRAO);
                console.log("[LIMPEZA] PIN inserido no modal.");
            }
        }

        // Clica no botão "Ok" verde do modal
        await page.evaluate(() => {
            const botoes = Array.from(document.querySelectorAll('button'));
            const btnOk = botoes.find(b => b.innerText.trim() === 'Ok' && b.classList.contains('btn-success'));
            if (btnOk) btnOk.click();
        });

        // Espera apagar e recarrega a lista
        await new Promise(r => setTimeout(r, 5000));
        await page.goto("https://iboplayer.pro/manage-playlists/list/", { waitUntil: "networkidle2" });
        
        // Verifica se ainda restam mais playlists
        temBotaoDelete = await page.$('.btn-warning.delete_playlist');
      }
      console.log("[LIMPEZA] Painel totalmente limpo!");
    }

    // 3. ADICIONAR NOVA PLAYLIST (O restante do código continua igual)
    await page.goto("https://iboplayer.pro/manage-playlists/list/", { waitUntil: "networkidle2" });
    
    // Verifica se já existe para não duplicar
    const existe = await page.evaluate(nome => {
      return document.body.innerText.toUpperCase().includes(nome.toUpperCase());
    }, pedido.nome);

    if (existe) {
      pedido.status = "ok";
      return;
    }

    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find(el => el.innerText.includes("Add Playlist"));
      if (btn) btn.click();
    });
    
    await new Promise(r => setTimeout(r, 4000));
    const inputs = await page.$$("input");
    if (inputs.length >= 2) {
      await inputs[0].type(pedido.nome);
      await inputs[1].type(pedido.m3u);

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
    console.log("[ERRO]:", err.message);
    pedido.status = "pendente";
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = executarBot;
