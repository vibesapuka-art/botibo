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
    // URL atualizada conforme suas imagens
    await page.goto("https://iboproapp.com/manage-playlists/login/", { waitUntil: "networkidle2" });
    
    await page.type("input[name='mac_address']", pedido.mac);
    await page.type("input[name='password']", pedido.key);
    await page.click("button[type='submit']");
    await new Promise(r => setTimeout(r, 8000));

    if (page.url().includes("login")) {
      pedido.status = "erro_login";
      return;
    }

    await page.goto("https://iboproapp.com/manage-playlists/list/", { waitUntil: "networkidle2" });

    if (pedido.acao === "EXCLUIR") {
      console.log(`[BOT] Localizando para excluir: ${pedido.nome}`);
      
      const clicouDeletar = await page.evaluate((nomeAlvo) => {
        const rows = Array.from(document.querySelectorAll('tr'));
        for (let row of rows) {
          if (row.innerText.toUpperCase().includes(nomeAlvo)) {
            const btn = row.querySelector('.delete_playlist');
            if (btn) { btn.click(); return true; }
          }
        }
        return false;
      }, pedido.nome);

      if (clicouDeletar) {
        await new Promise(r => setTimeout(r, 3000));
        
        // Digita o PIN no modal que apareceu
        const pinInput = await page.$('input[type="password"]');
        if (pinInput) {
          await pinInput.type(PIN_PADRAO);
          await page.keyboard.press('Enter');
        }

        // --- NOVA LÓGICA: CONFIRMAÇÃO DA MENSAGEM ---
        // Espera o balão de "A playlist deleted!"
        await new Promise(r => setTimeout(r, 5000));
        
        await page.evaluate(() => {
          // Procura o botão verde "Ok" que aparece na mensagem de sucesso
          const botoes = Array.from(document.querySelectorAll('button'));
          const btnOk = botoes.find(b => b.innerText.trim() === 'Ok' && b.classList.contains('btn-success'));
          if (btnOk) {
            btnOk.click();
          } else {
            // Se não achar o verde, tenta clicar em qualquer botão de fechar/Ok que esteja visível
            const qualquerOk = botoes.find(b => b.innerText.toUpperCase().includes('OK'));
            if (qualquerOk) qualquerOk.click();
          }
        });
        
        await new Promise(r => setTimeout(r, 2000));
      }
      
      pedido.status = "ok"; 
      console.log(`[BOT] Item processado: ${pedido.nome}`);

    } else {
      // Lógica de Adicionar (Add Playlist)
      const existe = await page.evaluate(n => document.body.innerText.toUpperCase().includes(n), pedido.nome);
      if (existe) {
        pedido.status = "ok";
      } else {
        await page.evaluate(() => {
          const btnAdd = Array.from(document.querySelectorAll("button")).find(el => el.innerText.includes("Add Playlist"));
          if (btnAdd) btnAdd.click();
        });
        await new Promise(r => setTimeout(r, 4000));
        const inputs = await page.$$("input");
        if (inputs.length >= 2) {
          await inputs[0].type(pedido.nome);
          await inputs[1].type(pedido.m3u);
          await page.evaluate(() => document.querySelector('input[type="checkbox"]').click());
          await new Promise(r => setTimeout(r, 2000));
          const pms = await page.$$('input[type="password"]');
          if (pms.length >= 2) {
            await pms[0].type(PIN_PADRAO);
            await pms[1].type(PIN_PADRAO);
          }
          await page.click('button[type="submit"]');
          await new Promise(r => setTimeout(r, 8000));
        }
        pedido.status = "ok";
      }
    }
  } catch (err) {
    console.log("Erro no processo:", err.message);
    pedido.status = "pendente";
  } finally {
    if (browser) await browser.close();
  }
}
module.exports = executarBot;
