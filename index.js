const express = require("express");
const bodyParser = require("body-parser");
const puppeteer = require("puppeteer");
const dnsConfig = require("./dns");

const app = express();
app.use(bodyParser.json());

let pedidos = [];

// TESTE
app.get("/", (req, res) => {
  res.send("Servidor IPTV rodando 🚀");
});

// RECEBER DADOS
app.post("/ativar", async (req, res) => {
  const { mac, key, user, pass } = req.body;

  if (!mac || !key || !user || !pass) {
    return res.status(400).send({ erro: "Dados incompletos" });
  }

  const listaDNS = dnsConfig.servidores;
  const servidor = listaDNS[Math.floor(Math.random() * listaDNS.length)];

  const m3u = `${servidor}/get.php?username=${user}&password=${pass}&type=m3u_plus`;

  pedidos.push({
    mac,
    key,
    m3u,
    nome: user,
    status: "pendente"
  });

  console.log("NOVO PEDIDO:", mac);

  res.send({ ok: true });
});

// BOT MAIS LEVE
async function processarPedidos() {
  const pendentes = pedidos.filter(p => p.status === "pendente").slice(0, 1);
  if (pendentes.length === 0) return;

  console.log("Processando 1 pedido...");

  let browser;

  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu"
      ]
    });

    const page = await browser.newPage();

    // LOGIN
    await page.goto("https://iboplayer.pro/manage-playlists/login/");
    await page.waitForSelector("input[name=mac]", { timeout: 15000 });

    await page.type("input[name=mac]", process.env.IBO_USER);
    await page.type("input[name=key]", process.env.IBO_PASS);

    await page.click("button[type=submit]");
    await page.waitForNavigation();

    for (let p of pendentes) {
      try {
        console.log("Ativando:", p.mac);

        await page.goto("https://iboplayer.pro/manage-playlists/list/");
        await page.waitForTimeout(3000);

        // CLICAR "Add Playlist"
        await page.evaluate(() => {
          const btn = [...document.querySelectorAll("button")]
            .find(b => b.innerText.includes("Add Playlist"));
          if (btn) btn.click();
        });

        await page.waitForTimeout(3000);

        // PREENCHER
        await page.type("input[placeholder='e.g. Favorite 1']", p.nome);
        await page.type("input[placeholder='.m3u or .m3u8']", p.m3u);

        // SUBMIT
        await page.evaluate(() => {
          const btn = [...document.querySelectorAll("button")]
            .find(b => b.innerText.includes("SUBMIT"));
          if (btn) btn.click();
        });

        await page.waitForTimeout(4000);

        p.status = "ok";
        console.log("ATIVO:", p.mac);

      } catch (err) {
        p.status = "erro";
        console.log("ERRO PEDIDO:", err.message);
      }
    }

  } catch (err) {
    console.log("ERRO GERAL:", err.message);
  }

  if (browser) await browser.close();
}

// LOOP MAIS LENTO (IMPORTANTE)
setInterval(processarPedidos, 60000);

// PORTA
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Servidor rodando na porta", PORT);
});
