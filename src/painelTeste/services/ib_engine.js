const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");
const todosDNS = require("../config/dns");

module.exports = async (pedidos, config = {}) => {
  if (!pedidos || !Array.isArray(pedidos)) return null;

  const pedido = pedidos.find(p => p.status === "processando");
  if (!pedido) return null;

  const atualizar = config.onUpdate || (() => {});

  let browser;

  try {
    atualizar({
      titulo: "📡 Acessando IB Player",
      mensagem: "Estamos acessando o painel do aplicativo. Mantenha a TV desligada ou o app fechado.",
      progresso: 45,
      etapaAtual: 2
    });

    browser = await puppeteer.launch({
      args: [
        ...chromium.args,
        "--no-sandbox",
        "--disable-setuid-sandbox"
      ],
      executablePath: await chromium.executablePath(),
      headless: true
    });

    const page = await browser.newPage();

    await page.setViewport({
      width: 1280,
      height: 800
    });

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    );

    const dnsSorteados = [...todosDNS]
      .sort(() => 0.5 - Math.random())
      .slice(0, 5);

    pedido.mensagem = "📡 ACESSANDO PAINEL...";

    await page.goto(
      "https://iboproapp.com/manage-playlists/login/",
      {
        waitUntil: "domcontentloaded",
        timeout: 60000
      }
    );

    atualizar({
      titulo: "🔐 Validando MAC e KEY",
      mensagem: "Estamos validando os dados do seu aplicativo IB Player.",
      progresso: 55,
      etapaAtual: 3
    });

    await page.waitForSelector("#mac_address", {
      timeout: 30000
    });

    await page.type("#mac_address", pedido.mac, {
      delay: 50
    });

    await page.type("#password", pedido.key || pedido.device_id, {
      delay: 50
    });

    await page.keyboard.press("Enter");

    await page.waitForSelector("button.btn-secondary", {
      timeout: 45000
    });

    atualizar({
      titulo: "✅ IB Player acessado",
      mensagem: "Acesso confirmado. Agora vamos adicionar as playlists.",
      progresso: 60,
      etapaAtual: 4
    });

    for (let i = 0; i < dnsSorteados.length; i++) {
      const numeroPlaylist = i + 1;
      const totalPlaylists = dnsSorteados.length;
      const nomeLista = `IMPTV${numeroPlaylist}`;

      atualizar({
        titulo: `📝 Adicionando playlist ${numeroPlaylist} de ${totalPlaylists}`,
        mensagem: `Estamos gravando a lista ${nomeLista}. Não feche esta página.`,
        progresso: 60 + numeroPlaylist * 6,
        etapaAtual: 4 + numeroPlaylist,
        playlistAtual: numeroPlaylist,
        totalPlaylists
      });

      const jaExiste = await page.evaluate((nome) => {
        const celulas = Array.from(document.querySelectorAll("td"));
        return celulas.some(td => td.innerText.trim() === nome);
      }, nomeLista);

      if (jaExiste) {
        console.log(`⚠️ ${nomeLista} já existe. Pulando...`);

        atualizar({
          titulo: `✅ Playlist ${numeroPlaylist} já existia`,
          mensagem: `${nomeLista} já estava cadastrada. Continuando...`,
          progresso: 60 + numeroPlaylist * 6,
          etapaAtual: 4 + numeroPlaylist,
          playlistAtual: numeroPlaylist,
          totalPlaylists
        });

        continue;
      }

      const baseDns = dnsSorteados[i];

      const urlFinal =
        `${baseDns}/get.php?username=${pedido.user}&password=${pedido.pass}&type=m3u_plus&output=mpegts`;

      pedido.mensagem = `📝 GRAVANDO ${nomeLista}...`;

      await page.evaluate(() => {
        const btnAdd = Array.from(document.querySelectorAll("button"))
          .find(b => b.innerText.includes("Add Playlist"));

        if (btnAdd) btnAdd.click();
      });

      await page.waitForSelector('input[name="name"]', {
        timeout: 15000
      });

      await page.type('input[name="name"]', nomeLista, {
        delay: 50
      });

      await page.type('input[name="url"]', urlFinal, {
        delay: 50
      });

      await page.click("#playlist-protected");

      await new Promise(r => setTimeout(r, 800));

      await page.type('input[name="pin"]', "123321", {
        delay: 50
      });

      await page.type('input[name="cpin"]', "123321", {
        delay: 50
      });

      await page.keyboard.press("Enter");

      await new Promise(r => setTimeout(r, 7000));

      await page.reload({
        waitUntil: "domcontentloaded"
      });

      await page.waitForSelector("button.btn-secondary", {
        timeout: 20000
      });

      atualizar({
        titulo: `✅ Playlist ${numeroPlaylist} adicionada`,
        mensagem: `${nomeLista} foi adicionada com sucesso.`,
        progresso: 60 + numeroPlaylist * 6,
        etapaAtual: 4 + numeroPlaylist,
        playlistAtual: numeroPlaylist,
        totalPlaylists
      });
    }

    atualizar({
      titulo: "🔄 Finalizando configuração",
      mensagem: "Estamos finalizando os últimos ajustes no seu aplicativo.",
      progresso: 95,
      etapaAtual: 10
    });

    pedido.mensagem = "✅ PROCESSO FINALIZADO! PODE LIGAR A TV.";
    pedido.status = "ok";

    atualizar({
      titulo: "✅ Tudo pronto!",
      mensagem: "Seu IB Player foi configurado com sucesso. Abra o aplicativo e atualize a lista.",
      progresso: 100,
      etapaAtual: 11
    });

    if (config.manterAberto) {
      return {
        browser,
        page
      };
    }

    await browser.close();
    return null;

  } catch (err) {
    if (browser) {
      const pages = await browser.pages();

      if (pages[0]) {
        await pages[0].screenshot({
          path: "public/erro_final.png",
          fullPage: true
        });
      }

      await browser.close();
    }

    throw err;
  }
};
