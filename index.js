const express = require("express");
const bodyParser = require("body-parser");
const dnsConfig = require("./dns");
const executarBot = require("./bot");

const app = express();
app.use(bodyParser.json());

let pedidos = [];

// TESTE
app.get("/", (req, res) => {
  res.send("Servidor IPTV rodando 🚀");
});

// RECEBER DADOS
app.post("/ativar", (req, res) => {
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

// LOOP DO BOT
setInterval(() => {
  executarBot(pedidos);
}, 60000);

// PORTA
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Servidor rodando na porta", PORT);
});
