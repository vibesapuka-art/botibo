const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

async function executarBot(pedidos) {
  const pedido = pedidos.find(p => p.status === "pendente" || p.status === "processando");
  if (!pedido) return;

  pedido.status = "processando";
  const PIN_PADRAO = "123321";

  // Lista exata das suas playlists para exclusão seletiva
  const NOSSAS_PLAYLISTS = [
    "XW", "MEUSRV", "PRD", "SOLAR", "ATBX", "ATN", "OD", "ECPS", 
    "TITA", "VR766", "HADES", "IFX", "NTB", "FLASH", "OLYMPUS"
  ];

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
      console.log(`[ERRO] Login inválido para: ${pedido.mac}`);
      pedido.status = "erro_login";
      return;
    }

    // 2. LOGICA DE LIMPEZA SELETIVA (Apaga apenas as nossas listas)
    if (pedido.limpar === true) {
      console.log(`[LIMPEZA] Iniciando faxina seletiva no MAC: ${pedido.mac}`);
      await page.goto("https://iboplayer.pro/manage-playlists/list/", { waitUntil: "networkidle2" });
      await new Promise(r => setTimeout(r, 3000));

      // Função para encontrar a próxima playlist nossa na lista
      const encontrarNossaPlaylist = async () => {
        return await page.evaluate((nomes) => {
          const linhas = Array.from(document.querySelectorAll('tr'));
          for (let linha of linhas) {
            const colunaNome = linha.querySelector('td:first-child');
            if (colunaNome && nomes.includes(colunaNome.innerText.trim().toUpperCase())) {
              const btnDelete = linha.querySelector('.btn-warning.delete_playlist');
              if (btnDelete) return true;
            }
          }
          return false;
        }, NOSSAS_PLAYLISTS);
      };

      let temNossaParaApagar = await encontrarNossaPlaylist();

      while (temNossaParaApagar) {
        console.log("[LIMPEZA] Removendo uma playlist do sistema...");
        
        // Clica no botão delete da primeira linha que for "nossa"
        await page.evaluate((nomes) => {
          const linhas = Array.from(document.querySelectorAll('tr'));
          for (let linha of linhas) {
            const colunaNome = linha.querySelector('td:first-child');
            if (colunaNome && nomes.includes(colunaNome.innerText.trim().toUpperCase())) {
              const btnDelete = linha.querySelector('.btn-warning.delete_playlist');
              if (btnDelete) { btnDelete.click(); return; }
            }
          }
        }, NOSSAS_PLAYLISTS);

        await new Promise(r => setTimeout(r, 2000));

        // Digita o PIN no Modal
        const inputsModal = await page.$$('input[type="password"]');
        for (let input of inputsModal) {
            const box = await input.boundingBox();
            if (box) await input.type(PIN_PADRAO);
        }

        // Clica no OK verde
        await page.evaluate(() => {
            const btnOk = Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === 'Ok' && b.classList.contains('btn-success'));
            if (btnOk) btnOk.click();
        });

        await new Promise(r => setTimeout(r, 5000));
        await page.goto("https://iboplayer.pro/manage-playlists/list/", { waitUntil: "networkidle2" });
        temNossaParaApagar = await encontrarNossaPlaylist();
      }
      console.log("[LIMPEZA] Faxina seletiva concluída.");
    }

    // 3. ADICIONAR NOVA PLAYLIST
    await page.goto("https://iboplayer.pro/manage-playlists/list/", { waitUntil: "networkidle2" });
    const existe = await page.evaluate(nome => {
      return document.body.innerText.toUpperCase().includes(nome.toUpperCase());
    }, pedido.nome);

    if (existe) {
      console.log(`[PULO] ${pedido.nome} já existe.`);
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
      console.log(`[OK] ${pedido.nome} Adicionada.`);
    }

  } catch (err) {
    console.log("[ERRO]:", err.message);
    pedido.status = "pendente";
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = executarBot;
