const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function executarBot(pedidos) {
  const pendentes = pedidos.filter(p => p.status === "pendente" || p.status === "processando");
  if (pendentes.length === 0) return;

  const pedido = pendentes[0];
  const NOVO_PIN = "123321"; 

  console.log(`Tentando novamente: ${pedido.mac} | DNS: ${pedido.m3u}`);
  let browser;

  try {
    browser = await puppeteer.launch({
      args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      executablePath: await chromium.executablePath(),
      headless: true
    });

    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(60000);

    // LOGIN
    await page.goto("https://iboplayer.pro/manage-playlists/login/");
    const inputsLogin = await page.$$("input");
    await inputsLogin[0].type(process.env.IBO_USER, { delay: 50 });
    await inputsLogin[1].type(process.env.IBO_PASS, { delay: 50 });
    await page.evaluate(() => document.querySelector("button[type=submit]").click());
    await sleep(8000);

    // LISTA
    await page.goto("https://iboplayer.pro/manage-playlists/list/");
    await sleep(5000);

    // CLICAR EM ADD
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find(el => el.innerText.includes("Add Playlist"));
      if (btn) btn.click();
    });
    await sleep(5000);

    // PREENCHER NOME E URL
    const inputs = await page.$$("input");
    await inputs[0].type(pedido.nome, { delay: 60 });
    await inputs[1].type(pedido.m3u, { delay: 40 });

    // ATIVAR PROTEÇÃO (Tentativa de clique mais robusta)
    console.log("Ativando proteção...");
    await page.evaluate(() => {
      const label = Array.from(document.querySelectorAll("label")).find(el => el.innerText.includes("Protect"));
      if (label) label.click(); // Clicar na label é mais seguro que no checkbox direto
      const check = document.querySelector('input[type="checkbox"]');
      if (check && !check.checked) check.click();
    });
    await sleep(4000);

    // PREENCHER PIN E CONFIRMAR
    const todosInputs = await page.$$("input");
    // O formulário expande: Nome(0), URL(1), Checkbox(2), PIN(3), Confirm PIN(4)
    if (todosInputs.length >= 5) {
      // PIN 1
      await todosInputs[3].focus();
      await todosInputs[3].type(NOVO_PIN, { delay: 100 });
      await sleep(1000);
      
      // PIN 2 (Confirmação)
      await todosInputs[4].focus();
      await todosInputs[4].type(NOVO_PIN, { delay: 100 });
      console.log("PINs inseridos.");
    }

    // FORÇAR RECONHECIMENTO
    await page.evaluate(() => {
      document.querySelectorAll("input").forEach(i => {
        i.dispatchEvent(new Event("input", { bubbles: true }));
        i.dispatchEvent(new Event("change", { bubbles: true }));
      });
    });
    await sleep(3000);

    // CLICAR EM SUBMIT E AGUARDAR
    await page.evaluate(() => {
      const btn = document.querySelector('button[type="submit"]');
      if (btn) btn.click();
    });

    console.log("Submit enviado. Verificando lista...");
    await sleep(12000); // Tempo maior para o site processar o banco de dados

    // RECARREGAR E VERIFICAR
    await page.goto("https://iboplayer.pro/manage-playlists/list/", { waitUntil: "networkidle2" });
    const confirmado = await page.evaluate((url) => document.body.innerText.includes(url), pedido.m3u);

    if (confirmado) {
      pedido.status = "ok";
      console.log("SUCESSO: Playlist confirmada na listagem!");
    } else {
      // Se falhar, vamos tirar um log do que o bot está vendo (opcional para debug)
      throw new Error("DNS não encontrado na tabela após salvamento.");
    }

  } catch (err) {
    pedido.status = "erro";
    console.log("ERRO:", err.message);
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = executarBot;
