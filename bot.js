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
      args: [...chromium.args, "--no-sandbox"],
      executablePath: await chromium.executablePath(),
      headless: true
    });

    const page = await browser.newPage();
    await page.goto("https://iboplayer.pro/manage-playlists/login/", { waitUntil: "networkidle2" });
    await page.type("input[name='mac_address']", pedido.mac);
    await page.type("input[name='password']", pedido.key);
    await page.click("button[type='submit']");
    await new Promise(r => setTimeout(r, 7000));

    // FUNÇÃO DE LIMPEZA
    const realizarLimpeza = async () => {
        await page.goto("https://iboplayer.pro/manage-playlists/list/", { waitUntil: "networkidle2" });
        let encontrou = true;
        while (encontrou) {
            encontrou = await page.evaluate((nomes) => {
                const linhas = Array.from(document.querySelectorAll('tr'));
                for (let linha of linhas) {
                    const texto = linha.innerText.toUpperCase();
                    const btn = linha.querySelector('.delete_playlist');
                    if (nomes.some(n => texto.includes(n)) && btn) {
                        btn.click();
                        return true;
                    }
                }
                return false;
            }, NOSSAS_LISTAS);

            if (encontrou) {
                await new Promise(r => setTimeout(r, 2000));
                const pins = await page.$$('input[type="password"]');
                if (pins.length > 0) {
                    await pins[0].type(PIN_PADRAO);
                    await page.keyboard.press('Enter');
                }
                await new Promise(r => setTimeout(r, 5000));
                await page.goto("https://iboplayer.pro/manage-playlists/list/");
            }
        }
    };

    // EXECUÇÃO
    if (pedido.somenteLimpar) {
        console.log(`[LIMPEZA] Apenas excluindo listas do MAC: ${pedido.mac}`);
        await realizarLimpeza();
        pedido.status = "ok"; // Finaliza o pedido de limpeza
    } else {
        // Fluxo normal de Adição
        console.log(`[ADICIONAR] Verificando ${pedido.nome}`);
        await page.goto("https://iboplayer.pro/manage-playlists/list/");
        const existe = await page.evaluate(n => document.body.innerText.toUpperCase().includes(n), pedido.nome);
        
        if (existe) {
            pedido.status = "ok";
        } else {
            // Lógica de adicionar (Add Playlist...)
            // [Mesmo código de preencher inputs que já temos]
            // ...
            pedido.status = "ok";
        }
    }

  } catch (err) {
    console.log("Erro:", err.message);
    pedido.status = "pendente";
  } finally {
    if (browser) await browser.close();
  }
}
module.exports = executarBot;
