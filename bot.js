const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

async function executarBot(pedidos) {
  const pedido = pedidos.find(p => p.status === "pendente" || p.status === "processando");
  if (!pedido) return;

  pedido.status = "processando";
  const PIN_PADRAO = "123321";

  let nomePlaylist = "IPTV"; 
  try {
    const urlLimpa = pedido.m3u.replace("http://", "").replace("https://", "");
    nomePlaylist = urlLimpa.split('.')[0].toUpperCase(); 
  } catch (e) {
    nomePlaylist = pedido.nome; 
  }

  console.log(`[BOT] INICIANDO DNS: ${pedido.m3u} | NOME: ${nomePlaylist}`);

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
    
    // Aguarda o tempo de resposta do servidor
    await new Promise(r => setTimeout(r, 8000));

    // --- NOVA TRAVA DE SEGURANÇA: VERIFICAÇÃO DE LOGIN ---
    const loginInvalido = await page.evaluate(() => {
      // Verifica se a mensagem de "Invalid request" apareceu ou se ainda estamos na tela de login
      return document.body.innerText.includes("Invalid request") || 
             document.querySelector("input[name='mac_address']") !== null;
    });

    if (loginInvalido) {
      console.log(`[ERRO] MAC ou KEY inválidos para: ${pedido.mac}. Parando bot.`);
      pedido.status = "erro_login"; // Marca como erro para o seu index.html avisar o cliente
      return; 
    }
    // -----------------------------------------------------

    console.log(`[LOGIN OK] Iniciando processamento para ${pedido.mac}`);

    // 2. LISTA E VERIFICAÇÃO
    await page.goto("https://iboplayer.pro/manage-playlists/list/", { waitUntil: "networkidle2" });
    const existe = await page.evaluate(nome => {
      return document.body.innerText.toUpperCase().includes(nome.toUpperCase());
    }, nomePlaylist);

    if (existe) {
      console.log(`[PULO] Playlist "${nomePlaylist}" já existe.`);
      pedido.status = "ok";
      return;
    }

    // 3. ADICIONAR PLAYLIST
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find(el => el.innerText.includes("Add Playlist"));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 4000));

    // 4. PREENCHER DADOS
    const inputs = await page.$$("input");
    if (inputs.length >= 2) {
      await inputs[0].type(nomePlaylist, { delay: 50 });
      await inputs[1].type(pedido.m3u, { delay: 50 });

      // 5. PIN PROTEÇÃO
      await page.evaluate(() => {
        const check = document.querySelector('input[type="checkbox"]');
        if (check) check.click();
      });
      await new Promise(r => setTimeout(r, 2000));

      // 6. PREENCHER PIN
      const todosInputs = await page.$$("input");
      if (todosInputs.length >= 5) {
        await todosInputs[3].type(PIN_PADRAO, { delay: 100 });
        await todosInputs[4].type(PIN_PADRAO, { delay: 100 });
      }

      // 7. SUBMIT
      await page.evaluate(() => {
        const btn = document.querySelector('button[type="submit"]');
        if (btn) btn.click();
      });

      await new Promise(r => setTimeout(r, 12000));
      pedido.status = "ok";
      console.log(`[SUCESSO] Playlist "${nomePlaylist}" enviada.`);
    }

  } catch (err) {
    console.log("[FALHA]", err.message);
    pedido.status = "pendente"; 
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = { executarBot };
