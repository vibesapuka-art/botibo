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
      args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox"],
      executablePath: await chromium.executablePath(),
      headless: true
    });

    const page = await browser.newPage();
    await page.goto("https://iboproapp.com/manage-playlists/login/", { waitUntil: "networkidle2" });
    
    // Login
    await page.type("input[name='mac_address']", pedido.mac);
    await page.type("input[name='password']", pedido.key);
    await page.click("button[type='submit']");
    await new Promise(r => setTimeout(r, 10000));

    await page.goto("https://iboproapp.com/manage-playlists/list/", { waitUntil: "networkidle2" });
    
    // Aguarda a tabela aparecer
    await page.waitForSelector('table', { timeout: 10000 });

    if (pedido.acao === "EXCLUIR") {
      console.log(`[EXECUÇÃO] Tentando deletar via Script: ${pedido.nome}`);
      
      // Tentativa de clique direto via evaluate (mais forte que o clique do Puppeteer)
      const resultadoAcao = await page.evaluate((nomeAlvo) => {
        const rows = Array.from(document.querySelectorAll('tr'));
        const alvo = rows.find(r => r.innerText.toUpperCase().includes(nomeAlvo.toUpperCase()));
        
        if (alvo) {
          const btn = alvo.querySelector('.delete_playlist');
          if (btn) {
            btn.click(); // Clique via JavaScript puro
            return "CLICADO";
          }
        }
        return "NAO_LOCALIZADO";
      }, pedido.nome);

      if (resultadoAcao === "CLICADO") {
        console.log(`[OK] Modal de PIN deve estar aberto.`);
        await new Promise(r => setTimeout(r, 4000));

        // Digita o PIN no modal
        const inputPin = await page.$('input[type="password"]');
        if (inputPin) {
          await inputPin.focus();
          await page.keyboard.type(PIN_PADRAO, { delay: 150 });
          await new Promise(r => setTimeout(r, 1000));
          await page.keyboard.press('Enter');
          
          // Espera o processamento do site
          await new Promise(r => setTimeout(r, 10000));
          
          // Fecha qualquer alerta de sucesso que aparecer
          await page.evaluate(() => {
            const btnOk = Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === 'Ok');
            if (btnOk) btnOk.click();
          });
        }
        pedido.status = "ok";
      } else {
        console.log(`[AVISO] ${pedido.nome} não encontrado na lista atual.`);
        pedido.status = "ok"; // Marca como ok para não travar a fila se o item já sumiu
      }

    } else {
      // Outras ações (Ativar/Adicionar)
      pedido.status = "ok";
    }
  } catch (err) {
    console.log(`[ERRO] Falha no processo: ${err.message}`);
    pedido.status = "pendente";
  } finally {
    if (browser) await browser.close();
  }
}
module.exports = executarBot;
