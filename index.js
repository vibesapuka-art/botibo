const express = require("express");
const bodyParser = require("body-parser");
const dnsConfig = require("./dns");
const executarBot = require("./bot");

const app = express();
app.use(bodyParser.json());

let pedidos = [];
let botOcupado = false; // Trava para não abrir dois navegadores ao mesmo tempo

app.post("/ativar", (req, res) => {
  const { mac, key, user, pass } = req.body;
  if (!mac || !key || !user || !pass) return res.status(400).send({ erro: "Dados incompletos" });

  dnsConfig.servidores.forEach((servidor) => {
    pedidos.push({
      mac, key,
      m3u: `${servidor}/get.php?username=${user}&password=${pass}&type=m3u_plus`,
      nome: user,
      status: "pendente"
    });
  });

  res.send({ ok: true, msg: "Fila iniciada" });
});

setInterval(async () => {
  // Só inicia se o bot não estiver ocupado e houver pedidos
  if (!botOcupado && pedidos.some(p => p.status === "pendente")) {
    botOcupado = true;
    try {
      // Processa apenas UM por vez e aguarda o fim real
      await executarBot(pedidos);
    } catch (e) {
      console.log("Erro no ciclo:", e.message);
    } finally {
      // Limpa finalizados e libera o bot para o próximo DNS
      pedidos = pedidos.filter(p => p.status !== "ok");
      botOcupado = false; 
    }
  }
}, 10000); // Tenta verificar a fila a cada 10 segundos

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Servidor em execução"));
