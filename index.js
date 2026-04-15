const express = require("express");
const bodyParser = require("body-parser");
const dnsConfig = require("./dns");
const executarBot = require("./bot");

const app = express();
app.use(bodyParser.json());

let pedidos = [];
let botOcupado = false;

app.post("/ativar", (req, res) => {
  const { mac, key, user, pass } = req.body;
  if (!mac || !key || !user || !pass) return res.status(400).send({ erro: "Dados incompletos" });

  // Adiciona apenas o primeiro DNS da lista para este teste
  const servidor = dnsConfig.servidores[0]; 
  const m3u = `${servidor}/get.php?username=${user}&password=${pass}&type=m3u_plus`;

  pedidos.push({ mac, key, m3u, nome: user, status: "pendente" });
  console.log("NOVO PEDIDO NA FILA:", mac);
  res.send({ ok: true });
});

// Loop a cada 40 segundos para dar tempo do Render respirar
setInterval(async () => {
  if (!botOcupado && pedidos.some(p => p.status === "pendente")) {
    botOcupado = true;
    pedidos = pedidos.filter(p => p.status !== "ok"); // Remove finalizados
    try {
      await executarBot(pedidos);
    } catch (e) {
      console.log("Falha no ciclo:", e.message);
    } finally {
      botOcupado = false;
    }
  }
}, 40000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Servidor rodando porta", PORT));
