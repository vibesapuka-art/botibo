const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");
const executarBot = require("./bot");

const app = express();
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

let pedidos = [];
let botOcupado = false;

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.post("/ativar", (req, res) => {
  const { mac, key, user, pass } = req.body;
  if (!mac || !key || !user || !pass) return res.status(400).send({ erro: "Dados incompletos" });

  // Carrega as URLs do arquivo JSON
  const dataConfig = JSON.parse(fs.readFileSync('./dns.json', 'utf8'));

  dataConfig.servidores.forEach((servidor) => {
    let nomeSugerido = "IPTV";
    try {
      const urlLimpa = servidor.replace("http://", "").replace("https://", "");
      nomeSugerido = urlLimpa.split('.')[0].toUpperCase();
    } catch (e) {
      nomeSugerido = user;
    }

    const m3u = `${servidor}/get.php?username=${user}&password=${pass}&type=m3u_plus`;
    
    pedidos.push({
      mac: mac.trim(),
      key: key.trim(),
      m3u: m3u.trim(),
      nome: nomeSugerido,
      status: "pendente"
    });
  });

  console.log(`[FILA] Novo pedido para MAC: ${mac} (${dataConfig.servidores.length} Playlists)`);
  res.send({ ok: true });
});

app.get("/status", (req, res) => {
  const { mac } = req.query;
  const dataConfig = JSON.parse(fs.readFileSync('./dns.json', 'utf8'));
  const total = dataConfig.servidores.length;
  const pendentes = pedidos.filter(p => p.mac === mac).length;
  const concluidos = total - pendentes;

  res.json({
    concluidos: concluidos >= 0 ? concluidos : 0,
    total: total
  });
});

setInterval(async () => {
  if (!botOcupado) {
    const proximo = pedidos.find(p => p.status === "pendente");
    if (proximo) {
      botOcupado = true;
      proximo.status = "processando"; 
      try {
        await executarBot(pedidos);
      } catch (e) {
        console.log("[ERRO]", e.message);
      } finally {
        pedidos = pedidos.filter(p => p.status !== "ok");
        botOcupado = false;
      }
    }
  }
}, 30000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Rodando na porta ${PORT}`));
