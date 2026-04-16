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

    if (pedido.acao === "EXCLUIR") {
      console.log(`[TENTATIVA] Excluindo servidor: ${pedido.nome}`);
      
      const clicou = await page.evaluate((nomeAlvo) => {
        const rows = Array.from(document.querySelectorAll('tr'));
        for (let row of rows) {
          if (row.innerText.toUpperCase().includes(nomeAlvo)) {
            const btn = row.querySelector('.delete_playlist');
            if (btn) { 
              btn.scrollIntoView();
              btn.click(); 
              return true; 
            }
          }
        }
        return false;
      }, pedido.nome);

      if (clicou) {
        // Espera o modal de PIN abrir totalmente
        await new Promise(r => setTimeout(r, 5000));
        
        // Clica no campo de PIN para garantir o foco
        await page.click('input[type="password"]');
        
        // Digita o PIN pausadamente (como um humano)
        await page.keyboard.type(PIN_PADRAO, { delay: 200 });
        await new Promise(r => setTimeout(r, 1000));
        
        // Pressiona Enter e clica no botão OK do PIN
        await page.keyboard.press('Enter');
        await page.evaluate(() => {
          const btnOk = Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === 'Ok');
          if (btnOk) btnOk.click();
        });

        // AGUARDA O SITE PROCESSAR (O ponto crítico)
        console.log(`[AGUARDE] Esperando 12 segundos para o servidor processar a exclusão...`);
        await new Promise(r => setTimeout(r, 12000));

        // Tenta fechar o balão de sucesso se ele aparecer
        await page.evaluate(() => {
          const btnSucesso = Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === 'Ok' && b.classList.contains('btn-success'));
          if (btnSucesso) btnSucesso.click();
        });

        // VERIFICAÇÃO FINAL APÓS RELOAD
        await page.reload({ waitUntil: "networkidle2" });
        const aindaExiste = await page.evaluate((n) => document.body.innerText.toUpperCase().includes(n), pedido.nome);

        if (!aindaExiste) {
          console.log(`[SUCESSO] ${pedido.nome} removido da página.`);
          pedido.status = "ok";
        } else {
          console.log(`[ERRO] ${pedido.nome} não sumiu. O site pode estar bloqueando.`);
          pedido.status = "pendente"; // Joga para o fim da fila para tentar outro
        }
      } else {
        console.log(`[PULO] ${pedido.nome} não foi encontrado.`);
        pedido.status = "ok";
      }

    } else {
      // Fluxo de Ativação
      pedido.status = "ok";
    }
  } catch (err) {
    console.log(`[ERRO CRÍTICO] ${err.message}`);
    pedido.status = "pendente";
  } finally {
    if (browser) await browser.close();
  }
}
module.exports = executarBot;
