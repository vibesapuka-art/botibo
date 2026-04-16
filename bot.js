const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

async function executarBot(pedidos) {
  const pedido = pedidos.find(p => p.status === "pendente" || p.status === "processando");
  if (!pedido) return;

  pedido.status = "processando";
  const PIN_PADRAO = "123321";

  // Lógica para extrair o nome do servidor (ex: de http://cbr.inft2... extrai "cbr")
  let nomePlaylist = "IPTV"; 
  try {
    const urlLimpa = pedido.m3u.replace("http://", "").replace("https://", "");
    nomePlaylist = urlLimpa.split('.')[0].toUpperCase(); // Extrai "CBR"
  } catch (e) {
    nomePlaylist = pedido.nome; // Fallback para o nome do usuário se falhar
  }

  console.log(`PROCESSANDO DNS: ${pedido.m3u} | NOME: ${nomePlaylist}`);

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

    // 2. LISTA E VERIFICAÇÃO (Agora pelo NOME da playlist)
    await page.goto("https://iboplayer.pro/manage-playlists/list/", { waitUntil: "networkidle2" });
    const existe = await page.evaluate(nome => {
      return document.body.innerText.toUpperCase().includes(nome.toUpperCase());
    }, nomePlaylist);

    if (existe) {
      console.log(`Playlist "${nomePlaylist}" já cadastrada. Pulando.`);
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
      await inputs[0].type(nomePlaylist, { delay: 50 }); // Nome extraído (CBR)
      await inputs[1].type(pedido.m3u, { delay: 50 });

      // 5. ATIVAR O PIN
      console.log("Ativando proteção por PIN...");
      await page.evaluate(() => {
        const check = document.querySelector('input[type="checkbox"]');
        if (check) check.click();
      });
      await new Promise(r => setTimeout(r, 2000));

      // 6. PREENCHER PIN E CONFIRMAÇÃO
      const todosInputs = await page.$$("input");
      if (todosInputs.length >= 5) {
        await todosInputs[3].type(PIN_PADRAO, { delay: 100 });
        await todosInputs[4].type(PIN_PADRAO, { delay: 100 });
      }

      // 7. FINALIZAR (SUBMIT)
      await page.evaluate(() => {
        const btn = document.querySelector('button[type="submit"]');
        if (btn) btn.click();
      });

      // Aguarda o site processar o salvamento
      await new Promise(r => setTimeout(r, 12000));
      
      // 8. VERIFICAÇÃO FINAL POR NOME
      await page.goto("https://iboplayer.pro/manage-playlists/list/", { waitUntil: "networkidle2" });
      const salvo = await page.evaluate(nome => {
          return document.body.innerText.toUpperCase().includes(nome.toUpperCase());
      }, nomePlaylist);
      
      if (salvo) {
        pedido.status = "ok";
        console.log(`SUCESSO TOTAL: Playlist "${nomePlaylist}" criada.`);
      } else {
        // Se ainda não aparecer, marcamos como OK de qualquer forma para não looper, 
        // já que você confirmou que no manual ela aparece depois.
        console.log("Aviso: Nome não apareceu na lista ainda, mas o comando foi enviado.");
        pedido.status = "ok"; 
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
