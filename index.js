const express = require("express");
const bodyParser = require("body-parser");
const dnsConfig = require("./dns");
const executarBot = require("./bot");

const app = express();
app.use(bodyParser.json());

let pedidos = [];
let botOcupado = false;

app.get("/", (req, res) => res.send("Servidor IPTV Ativo 🚀"));

app.post("/ativar", (req, res) => {
  const { mac, key, user, pass } = req.body;

  if (!mac || !key || !user || !pass) {
    return res.status(400).send({ erro: "Dados incompletos" });
  }

  // Adiciona todos os DNS da lista para este MAC na fila
  dnsConfig.servidores.forEach((servidor) => {
    const m3u = `${servidor}/get.php?username=${user}&password=${pass}&type=m3u_plus`;
    pedidos.push({
      mac, key, m3u,
      nome: user,
      status: "pendente"
    });
  });

  console.log(`Fila atualizada: ${dnsConfig.servidores.length} DNS adicionados para o MAC ${mac}`);
  res.send({ ok: true });
});

// Loop de processamento (Verifica a fila a cada 20 segundos)
setInterval(async () => {
  if (!botOcupado && pedidos.some(p => p.status === "pendente")) {
    botOcupado = true;
    
    // Remove os que já foram concluídos da memória
    pedidos = pedidos.filter(p => p.status !== "ok");

    try {
      await executarBot(pedidos);
    } catch (e) {
      console.log("Erro no ciclo do bot:", e.message);
    } finally {
      botOcupado = false;
    }
  }
}, 20000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Servidor rodando na porta", PORT));
