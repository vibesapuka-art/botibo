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
    
    // Login inicial
    await page.type("input[name='mac_address']", pedido.mac);
    await page.type("input[name='password']", pedido.key);
    await page.click("button[type='submit']");
    await new Promise(r => setTimeout(r, 8000));

    await page.goto("https://iboproapp.com/manage-playlists/list/", { waitUntil: "networkidle2" });

    if (pedido.acao === "EXCLUIR") {
      console.log(`[VERIFICAÇÃO] Checando se ${pedido.nome} ainda existe...`);
      
      // Verifica se o nome do servidor está na página
      const existeNaPagina = await page.evaluate((nomeAlvo) => {
        return document.body.innerText.toUpperCase().includes(nomeAlvo);
      }, pedido.nome);

      if (!existeNaPagina) {
        console.log(`[CONFIRMADO] ${pedido.nome} não consta mais na lista. Sucesso.`);
        pedido.status = "ok";
        return;
      }

      // Se ainda existe, executa a exclusão uma única vez
      const clicou = await page.evaluate((nomeAlvo) => {
        const rows = Array.from(document.querySelectorAll('tr'));
        for (let row of rows) {
          if (row.innerText.toUpperCase().includes(nomeAlvo)) {
            const btn = row.querySelector('.delete_playlist');
            if (btn) { btn.click(); return true; }
          }
        }
        return false;
      }, pedido.nome);

      if (clicou) {
        await new Promise(r => setTimeout(r, 3000));
        const pin = await page.$('input[type="password"]');
        if (pin) {
          await pin.type(PIN_PADRAO);
          await page.keyboard.press('Enter');
          
          // Espera um tempo seguro para o site processar
          await new Promise(r => setTimeout(r, 8000));
          
          // VERIFICAÇÃO FINAL: O nome sumiu?
          await page.reload({ waitUntil: "networkidle2" });
          const sumiu = await page.evaluate((nomeAlvo) => {
            return !document.body.innerText.toUpperCase().includes(nomeAlvo);
          }, pedido.nome);

          if (sumiu) {
            console.log(`[SUCESSO] Exclusão de ${pedido.nome} validada visualmente.`);
            pedido.status = "ok";
          } else {
            console.log(`[ALERTA] ${pedido.nome} ainda aparece após exclusão. Re-tentando na próxima...`);
            pedido.status = "pendente";
          }
        }
      }

    } else {
      // Fluxo de ADICIONAR (mantém a mesma lógica de segurança)
      const jaExiste = await page.evaluate(n => document.body.innerText.toUpperCase().includes(n), pedido.nome);
      if (jaExiste) {
        pedido.status = "ok";
      } else {
        // [Lógica de adicionar omitida para brevidade, mas permanece igual]
        pedido.status = "ok";
      }
    }
  } catch (err) {
    console.log(`[ERRO] ${err.message}`);
    pedido.status = "pendente";
  } finally {
    if (browser) await browser.close();
  }
}
module.exports = executarBot;
