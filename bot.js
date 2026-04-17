const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

async function executarBot(pedidos) {
  const pedido = pedidos.find(p => p.status === "pendente" || p.status === "processando");
  if (!pedido) return;

  pedido.status = "processando";
  const PIN_PADRAO = "123321";

  // Lógica de extração de nome (CBR, etc) do seu código antigo
  let nomePlaylist = "IPTV"; 
  try {
    const urlLimpa = pedido.m3u.replace("http://", "").replace("https://", "");
    nomePlaylist = urlLimpa.split('.')[0].toUpperCase();
  } catch (e) {
    nomePlaylist = "LISTA"; 
  }

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

    // 1. LOGIN (Com sua lógica de desbloqueio de botão)
    await page.goto("https://iboplayer.pro/manage-playlists/login/", { waitUntil: "networkidle2" });
    await page.type("input[name='mac_address']", pedido.mac);
    await page.type("input[name='password']", pedido.key);
    
    await page.evaluate(() => {
      const btn = document.querySelector("button[type='submit']");
      if (btn) { btn.disabled = false; btn.click(); }
    });
    
    // Aguarda o login processar
    await new Promise(r => setTimeout(r, 9000));

    // --- NOVA TRAVA DE SEGURANÇA: VERIFICA SE O LOGIN DEU ERRO ---
    const loginInvalido = await page.evaluate(() => {
      return document.body.innerText.includes("Invalid request") || 
             document.querySelector("input[name='mac_address']") !== null;
    });

    if (loginInvalido) {
      console.log(`[ERRO] MAC ou Key incorretos para: ${pedido.mac}`);
      pedido.status = "erro_login"; // Notifica o painel do cliente
      return; 
    }
    // -----------------------------------------------------------

    // 2. VERIFICAÇÃO DE EXISTÊNCIA (Seu código original)
    await page.goto("https://iboplayer.pro/manage-playlists/list/", { waitUntil: "networkidle2" });
    const existe = await page.evaluate(nome => {
      return document.body.innerText.toUpperCase().includes(nome.toUpperCase());
    }, nomePlaylist);

    if (existe) {
      console.log(`Playlist "${nomePlaylist}" já cadastrada.`);
      pedido.status = "ok";
      pedido.concluidos = 15;
      return;
    }

    // 3. ADICIONAR PLAYLIST
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find(el => el.innerText.includes("Add Playlist"));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 4000));

    // 4. PREENCHER DADOS E PIN (Sua lógica perfeita)
    const inputs = await page.$$("input");
    if (inputs.length >= 2) {
      await inputs[0].type(nomePlaylist, { delay: 50 });
      await inputs[1].type(pedido.m3u, { delay: 50 });

      // Ativar o PIN Checkbox
      await page.evaluate(() => {
        const check = document.querySelector('input[type="checkbox"]');
        if (check) check.click();
      });
      await new Promise(r => setTimeout(r, 2000));

      // Preencher o PIN
      const todosInputs = await page.$$("input");
      if (todosInputs.length >= 5) {
        await todosInputs[3].type(PIN_PADRAO, { delay: 100 });
        await todosInputs[4].type(PIN_PADRAO, { delay: 100 });
      }

      // Finalizar
      await page.evaluate(() => {
        const btn = document.querySelector('button[type="submit"]');
        if (btn) btn.click();
      });

      // Aguarda processamento longo como no seu código
      await new Promise(r => setTimeout(r, 12000));
      
      pedido.status = "ok";
      pedido.concluidos = 15;
      console.log(`SUCESSO: ${nomePlaylist} adicionada.`);
    }

  } catch (err) {
    console.log("FALHA NO BOT:", err.message);
    // Se for erro de sistema (ETXTBSY), avisa o cliente para recarregar
    if(err.message.includes("busy") || err.message.includes("spawn")) {
        pedido.status = "erro_sistema";
    } else {
        pedido.status = "pendente"; 
    }
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = executarBot;
