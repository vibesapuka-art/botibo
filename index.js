const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");
const executarBot = require("./bot");

const app = express();

// Middleware para JSON
app.use(bodyParser.json());

/**
 * 1. SOLUÇÃO PARA O ERRO "SENDSTREAM.ERROR":
 * Vamos garantir que o caminho da pasta esteja correto independente do sistema.
 * Verificamos se a pasta se chama "Public" ou "public".
 */
const pastaPublic = fs.existsSync(path.join(__dirname, "Public")) ? "Public" : "public";
app.use(express.static(path.join(__dirname, pastaPublic)));

let pedidos = [];
let botOcupado = false;

// Rota principal (Painel do Cliente)
app.get("/", (req, res) => {
  const file = path.join(__dirname, pastaPublic, "index.html");
  res.sendFile(file, (err) => {
    if (err) {
      console.error("Erro ao enviar index.html:", err.message);
      res.status(404).send("Erro: Arquivo index.html não encontrado. Verifique a pasta Public.");
    }
  });
});

// Rota de ativação
app.post("/ativar", (req, res) => {
  const { mac, key, user, pass } = req.body;
  if (!mac || !key || !user || !pass) return res.status(400).send({ erro: "Dados incompletos" });

  // Lista de URLs que você enviou
  const servidores = [
    "http://xw.pluss.fun", "http://meusrv.top:80", "http://prd.blc-atena.com",
    "http://solar.playblc.work", "http://atbx.blc-atena.com", "http://atn.blc-atena.com",
    "http://od.blc-atena.com", "http://ecps.blc-atena.com", "http://tita.playblc.work",
    "http://vr766.com", "http://hades.blcplay2.work", "http://ifx.blc-atena.com",
    "http://ntb.blc-atena.com", "http://flash.netpl4y.com", "http://olympus.netpl4y.com"
  ];

  servidores.forEach((servidor) => {
    let nomeSugerido = "IPTV";
    try {
      const urlLimpa = servidor.replace("http://", "").replace("https://", "");
      nomeSugerido = urlLimpa.split('.')[0].toUpperCase();
    } catch (e) { nomeSugerido = user; }

    const m3u = `${servidor}/get.php?username=${user}&password=${pass}&type=m3u_plus`;
    
    pedidos.push({
      mac: mac.trim(),
      key: key.trim(),
      m3u: m3u.trim(),
      nome: nomeSugerido,
      status: "pendente"
    });
  });

  console.log(`[FILA] Novo pedido para MAC: ${mac} (${servidores.length} Playlists)`);
  res.send({ ok: true });
});

// Rota de Status para a Barra de Carregamento
app.get("/status", (req, res) => {
  const { mac } = req.query;
  const totalPlaylists = 15; // Quantidade fixa baseada na sua lista acima
  const pendentesParaEsseMac = pedidos.filter(p => p.mac === mac).length;
  const concluidos = totalPlaylists - pendentesParaEsseMac;

  res.json({
    concluidos: concluidos >= 0 ? concluidos : 0,
    total: totalPlaylists
  });
});

// Loop do Bot
setInterval(async () => {
  if (!botOcupado) {
    const proximo = pedidos.find(p => p.status === "pendente");
    if (proximo) {
      botOcupado = true;
      proximo.status = "processando"; 
      try {
        await executarBot(pedidos);
      } catch (e) {
        console.log("[ERRO BOT]:", e.message);
      } finally {
        pedidos = pedidos.filter(p => p.status !== "ok");
        botOcupado = false;
      }
    }
  }
}, 30000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor Ativo na porta ${PORT}`));
