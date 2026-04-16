const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

async function executarBot(pedidos) {
  const pedido = pedidos.find(p => p.status === "pendente" || p.status === "processando");
  if (!pedido) return;

  pedido.status = "processando";
  const PIN_PADRAO = "123321";

  // Lista de Proxies Gratuitos (Pode ser que alguns falhem, o bot vai testar)
  const PROXY_LIST = [
    "http://45.160.88.50:8080",
    "http://189.126.108.162:8080",
    "http://168.197.64.12:3128"
  ];
  const randomProxy = PROXY_LIST[Math.floor(Math.random() * PROXY_LIST.length)];

  let browser;
  try {
    browser = await puppeteer.launch({
      args: [
        ...chromium.args,
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
        `--proxy-server=${randomProxy}`, // AQUI ESTÁ A MÁSCARA DE IP
        "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
      ],
      executablePath: await chromium.executablePath(),
      headless: true
    });

    const page = await browser.newPage();
    
    // Deixa o bot com "cara" de navegador de celular, já que o seu celular entra e o PC não
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

    console.log(`[BOT] Usando IP Mascarado: ${randomProxy}`);

    await page.goto("https://iboproapp.com/manage-playlists/login/", { 
      waitUntil: "networkidle2",
      timeout: 60000 
    });

    // Se aparecer o erro de Login, o bot vai tentar de novo sem o proxy
    const isInvalid = await page.evaluate(() => document.body.innerText.includes("Invalid request"));
    if (isInvalid) {
        throw new Error("O IP Mascarado também foi bloqueado. Tentando próxima rodada.");
    }

    // Login
    await page.type("input[name='mac_address']", pedido.mac);
    await page.type("input[name='password']", pedido.key);
    await page.click("button[type='submit']");
    await new Promise(r => setTimeout(r, 12000));

    await page.goto("https://iboproapp.com/manage-playlists/list/", { waitUntil: "networkidle2" });
    
    if (pedido.acao === "EXCLUIR") {
      // ... [Mesma lógica de exclusão por Script que fizemos antes]
      const clicou = await page.evaluate((nomeAlvo) => {
        const rows = Array.from(document.querySelectorAll('tr'));
        const alvo = rows.find(r => r.innerText.toUpperCase().includes(nomeAlvo.toUpperCase()));
        if (alvo) {
          const btn = alvo.querySelector('.delete_playlist');
          if (btn) { btn.click(); return true; }
        }
        return false;
      }, pedido.nome);

      if (clicou) {
        await new Promise(r => setTimeout(r, 4000));
        await page.keyboard.type(PIN_PADRAO, { delay: 150 });
        await page.keyboard.press('Enter');
        await new Promise(r => setTimeout(r, 10000));
      }
      pedido.status = "ok";
    }
    
  } catch (err) {
    console.log(`[ERRO COM IP MASCARADO] ${err.message}`);
    pedido.status = "pendente";
  } finally {
    if (browser) await browser.close();
  }
}
module.exports = executarBot;
