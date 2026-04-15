const express = require("express");
const bodyParser = require("body-parser");
const dnsConfig = require("./dns");
const executarBot = require("./bot");

const app = express();
app.use(bodyParser.json());

let pedidos = [];
let botOcupado = false;

app.get("/", (req, res) => res.send("Servidor Ativo 🚀"));

app.post("/ativar", (req, res) => {
  const { mac, key, user, pass } = req.body;
  if (!mac || !key || !user || !pass) return res.status(400).send({ erro: "Dados incompletos" });

  // Adiciona os DNS da sua lista para o MAC enviado
  dnsConfig.servidores.forEach((servidor) => {
    const m3u = `${servidor}/get.php?username=${user}&password=${pass}&type=m3u_plus`;
    pedidos.push({ mac, key, m3u, nome: user, status: "pendente" });
  });

  console.log(`Fila atualizada para o MAC: ${mac}`);
  res.send({ ok: true, msg: "Processamento iniciado" });
});

// Loop de processamento seguro
setInterval(async () => {
  if (!botOcupado && pedidos.some(p => p.status === "pendente")) {
    botOcupado = true;
    
    // Limpa da memória os que já foram finalizados
    pedidos = pedidos.filter(p => p.status !== "ok");

    try {
      await executarBot(pedidos);
    } catch (e) {
      console.log("Falha no ciclo do bot:", e.message);
    } finally {
      botOcupado = false; // Liberta para o próximo pedido apenas após fechar o anterior
    }
  }
}, 30000); // Tenta processar a cada 30 segundos

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor a correr na porta ${PORT}`));
