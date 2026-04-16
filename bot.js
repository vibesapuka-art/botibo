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
    // Forçamos o domínio que aparece nas suas capturas
    await page.goto("https://iboproapp.com/manage-playlists/login/", { waitUntil: "networkidle2" });
    
    await page.type("input[name='mac_address']", pedido.mac);
    await page.type("input[name='password']", pedido.key);
    await page.click("button[type='submit']");
    
    // Espera longa para garantir que o painel carregue
    await new Promise(r => setTimeout(r, 12000));

    // Vai direto para a lista
    await page.goto("https://iboproapp.com/manage-playlists/list/", { waitUntil: "networkidle2" });
    
    // Espera a tabela de playlists aparecer na tela
    await page.waitForSelector('table', { timeout: 10000 }).catch(() => console.log("Tabela não carregou a tempo"));

    if (pedido.acao === "EXCLUIR") {
      console.log(`[BUSCA] Procurando por: ${pedido.nome}`);
      
      // Essa função varre cada linha da tabela procurando o nome exato
      const seletorBotao = await page.evaluate((nomeAlvo) => {
        const linhas = Array.from(document.querySelectorAll('tr'));
        for (let i = 0; i < linhas.length; i++) {
          // Comparamos o texto de forma bruta para evitar erros de CSS
          if (linhas[i].innerText.toUpperCase().includes(nomeAlvo.toUpperCase())) {
            // Retornamos um seletor único para essa linha
            return `table tr:nth-child(${i + 1}) .delete_playlist`;
          }
        }
        return null;
      }, pedido.nome);

      if (seletorBotao) {
        console.log(`[AÇÃO] Botão encontrado para ${pedido.nome}. Clicando...`);
        await page.click(seletorBotao);
        
        await new Promise(r => setTimeout(r, 4000));
        
        // Modal de PIN
        const modalPin = await page.$('input[type="password"]');
        if (modalPin) {
          await modalPin.focus();
          await page.keyboard.type(PIN_PADRAO, { delay: 150 });
          await new Promise(r => setTimeout(r, 1000));
          await page.keyboard.press('Enter');
          
          // Espera o site processar e mostrar o "A playlist deleted!"
          await new Promise(r => setTimeout(r, 10000));
          
          // Clica no "Ok" da confirmação verde se ele existir
          await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const ok = btns.find(b => b.innerText.trim() === 'Ok' && b.classList.contains('btn-success'));
            if (ok) ok.click();
          });
        }
        pedido.status = "ok";
      } else {
        // Se cair aqui, é porque o bot realmente não viu o nome na página
        console.log(`[ERRO] O nome ${pedido.nome} não foi localizado no HTML da página.`);
        pedido.status = "pendente"; // Tenta de novo depois
      }

    } else {
      // Lógica de Ativação
      pedido.status = "ok";
    }
  } catch (err) {
    console.log(`[LOG] Erro: ${err.message}`);
    pedido.status = "pendente";
  } finally {
    if (browser) await browser.close();
  }
}
module.exports = executarBot;
