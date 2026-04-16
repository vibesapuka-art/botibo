const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

async function executarBot(pedidos) {
  // Encontra o próximo pedido na fila
  const pedido = pedidos.find(p => p.status === "pendente" || p.status === "processando");
  if (!pedido) return;

  pedido.status = "processando";
  const PIN_PADRAO = "123321";
  
  // Lista oficial das suas playlists para a limpeza seletiva
  const NOSSAS_LISTAS = [
    "XW", "MEUSRV", "PRD", "SOLAR", "ATBX", "ATN", "OD", "ECPS", 
    "TITA", "VR766", "HADES", "IFX", "NTB", "FLASH", "OLYMPUS"
  ];

  let browser;
  try {
    browser = await puppeteer.launch({
      args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
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

    // Verifica se o login falhou
    if (page.url().includes("login")) {
      console.log(`[ERRO] Login inválido para o MAC: ${pedido.mac}`);
      pedido.status = "erro_login";
      return;
    }

    // --- FUNÇÃO DE LIMPEZA SELETIVA ---
    const realizarLimpeza = async () => {
      console.log(`[LIMPEZA] Verificando playlists para excluir no MAC: ${pedido.mac}`);
      await page.goto("https://iboplayer.pro/manage-playlists/list/", { waitUntil: "networkidle2" });
      await new Promise(r => setTimeout(r, 3000));

      let encontrou = true;
      while (encontrou) {
        encontrou = await page.evaluate((nomes) => {
          const linhas = Array.from(document.querySelectorAll('tr'));
          for (let linha of linhas) {
            const textoLinha = linha.innerText.toUpperCase();
            const ehNossa = nomes.some(n => textoLinha.includes(n));
            const btnDelete = linha.querySelector('.delete_playlist');
            
            if (ehNossa && btnDelete) {
              btnDelete.click(); // Abre o modal de PIN
              return true;
            }
          }
          return false;
        }, NOSSAS_LISTAS);

        if (encontrou) {
          await new Promise(r => setTimeout(r, 2000));
          const inputPin = await page.$('input[type="password"]');
          if (inputPin) {
            await inputPin.type(PIN_PADRAO);
            await page.keyboard.press('Enter');
          }
          console.log("[LIMPEZA] Playlist removida, recarregando...");
          await new Promise(r => setTimeout(r, 5000));
          await page.goto("https://iboplayer.pro/manage-playlists/list/", { waitUntil: "networkidle2" });
        }
      }
      console.log("[LIMPEZA] Faxina seletiva concluída.");
    };

    // 2. DECISÃO DE FLUXO
    if (pedido.somenteLimpar === true) {
      // APENAS EXCLUI E SAI
      await realizarLimpeza();
      pedido.status = "ok";
      console.log(`[FINALIZADO] Limpeza concluída para ${pedido.mac}`);
    } else {
      // FLUXO NORMAL DE ATIVAÇÃO
      await page.goto("https://iboplayer.pro/manage-playlists/list/", { waitUntil: "networkidle2" });
      
      // Verifica se a playlist específica já existe
      const existe = await page.evaluate(nome => {
        return document.body.innerText.toUpperCase().includes(nome.toUpperCase());
      }, pedido.nome);

      if (existe) {
        console.log(`[PULO] Playlist ${pedido.nome} já existe no painel.`);
        pedido.status = "ok";
      } else {
        // Clica em "Add Playlist"
        await page.evaluate(() => {
          const btn = Array.from(document.querySelectorAll("button")).find(el => el.innerText.includes("Add Playlist"));
          if (btn) btn.click();
        });
        
        await new Promise(r => setTimeout(r, 4000));
        const inputs = await page.$$("input");
        
        if (inputs.length >= 2) {
          await inputs[0].type(pedido.nome);
          await inputs[1].type(pedido.m3u);

          // Ativa proteção por PIN
          await page.evaluate(() => {
            const check = document.querySelector('input[type="checkbox"]');
            if (check) check.click();
          });
          
          await new Promise(r => setTimeout(r, 2000));
          const camposSenha = await page.$$('input[type="password"]');
          if (camposSenha.length >= 2) {
            await camposSenha[0].type(PIN_PADRAO);
            await camposSenha[1].type(PIN_PADRAO);
          }

          await page.evaluate(() => {
            const btnSub = document.querySelector('button[type="submit"]');
            if (btnSub) btnSub.click();
          });

          await new Promise(r => setTimeout(r, 10000));
          pedido.status = "ok";
          console.log(`[SUCESSO] Playlist ${pedido.nome} adicionada.`);
        }
      }
    }

  } catch (err) {
    console.log("[ERRO NO BOT]:", err.message);
    pedido.status = "pendente"; // Joga de volta para a fila em caso de erro técnico
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = executarBot;
