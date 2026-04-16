const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

async function executarBot(pedidos) {
  const pedido = pedidos.find(p => p.status === "pendente" || p.status === "processando");
  if (!pedido) return;

  pedido.status = "processando";
  const PIN_PADRAO = "123321";
  const NOSSAS_LISTAS = ["XW", "MEUSRV", "PRD", "SOLAR", "ATBX", "ATN", "OD", "ECPS", "TITA", "VR766", "HADES", "IFX", "NTB", "FLASH", "OLYMPUS"];

  let browser;
  try {
    browser = await puppeteer.launch({
      args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox"],
      executablePath: await chromium.executablePath(),
      headless: true
    });

    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(60000);

    // 1. LOGIN (Atualizado para o novo domínio das suas fotos)
    await page.goto("https://iboproapp.com/manage-playlists/login/", { waitUntil: "networkidle2" });
    await page.type("input[name='mac_address']", pedido.mac);
    await page.type("input[name='password']", pedido.key);
    await page.click("button[type='submit']");
    await new Promise(r => setTimeout(r, 8000));

    // FUNÇÃO DE LIMPEZA MELHORADA
    const realizarLimpeza = async () => {
      console.log(`[LIMPEZA] Iniciando faxina seletiva...`);
      await page.goto("https://iboproapp.com/manage-playlists/list/", { waitUntil: "networkidle2" });
      
      let encontrouAlgo = true;
      while (encontrouAlgo) {
        encontrouAlgo = await page.evaluate((nomes) => {
          const linhas = Array.from(document.querySelectorAll('tr'));
          for (let linha of linhas) {
            const texto = linha.innerText.toUpperCase();
            // Verifica se a linha tem um de nossos nomes e se tem o botão amarelo de Delete
            const btnDelete = linha.querySelector('.btn-warning.delete_playlist') || linha.querySelector('.delete_playlist');
            if (nomes.some(n => texto.includes(n)) && btnDelete) {
              btnDelete.click();
              return true;
            }
          }
          return false;
        }, NOSSAS_LISTAS);

        if (encontrouAlgo) {
          console.log("[LIMPEZA] Modal de PIN detectado. Inserindo...");
          await new Promise(r => setTimeout(r, 2500));
          
          // Digita o PIN em qualquer campo de senha visível (modal)
          await page.evaluate((pin) => {
            const inputs = Array.from(document.querySelectorAll('input[type="password"]'));
            const inputVisivel = inputs.find(i => i.offsetParent !== null);
            if (inputVisivel) {
              inputVisivel.value = pin;
              // Dispara evento de input para o site reconhecer o texto
              inputVisivel.dispatchEvent(new Event('input', { bubbles: true }));
            }
            
            // Clica no botão "Ok" VERDE (btn-success) que aparece na sua foto
            const botoes = Array.from(document.querySelectorAll('button'));
            const btnOk = botoes.find(b => b.innerText.trim().toUpperCase() === 'OK' && b.classList.contains('btn-success'));
            if (btnOk) btnOk.click();
          }, PIN_PADRAO);

          await new Promise(r => setTimeout(r, 5000));
          await page.goto("https://iboproapp.com/manage-playlists/list/", { waitUntil: "networkidle2" });
        }
      }
    };

    // 2. EXECUÇÃO DO PEDIDO
    if (pedido.somenteLimpar === true) {
      await realizarLimpeza();
      pedido.status = "ok";
    } else {
      // Fluxo de ADICIONAR
      await page.goto("https://iboproapp.com/manage-playlists/list/", { waitUntil: "networkidle2" });
      const existe = await page.evaluate(n => document.body.innerText.toUpperCase().includes(n), pedido.nome);

      if (existe) {
        pedido.status = "ok";
      } else {
        // Clica em "Add Playlist"
        await page.evaluate(() => {
          const btn = Array.from(document.querySelectorAll("button, a")).find(el => el.innerText.includes("Add Playlist"));
          if (btn) btn.click();
        });
        
        await new Promise(r => setTimeout(r, 4000));
        const inputs = await page.$$("input");
        if (inputs.length >= 2) {
          await inputs[0].type(pedido.nome);
          await inputs[1].type(pedido.m3u);

          // Proteção por PIN
          const checkbox = await page.$('input[type="checkbox"]');
          if (checkbox) await checkbox.click();
          
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
        }
      }
    }

  } catch (err) {
    console.log("[ERRO]:", err.message);
    pedido.status = "pendente";
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = executarBot;
