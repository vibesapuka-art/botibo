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

  // No celular, lembre-se de enviar como application/json
  if (!mac || !key || !user || !pass) {
    return res.status(400).send({ erro: "Dados incompletos" });
  }

  // Adiciona todos os servidores da sua lista de DNS
  dnsConfig.servidores.forEach((servidor) => {
    const m3u = `${servidor}/get.php?username=${user}&password=${pass}&type=m3u_plus`;
    pedidos.push({
      mac,
      key,
      m3u,
      nome: user,
      status: "pendente"
    });
  });

  console.log(`Fila atualizada para MAC: ${mac}`);
  res.send({ ok: true });
});

// Loop de processamento inteligente
setInterval(async () => {
  // Só inicia se o bot não estiver ocupado e houver algo pendente
  if (!botOcupado) {
    const proximo = pedidos.find(p => p.status === "pendente");

    if (proximo) {
      botOcupado = true;
      
      // MUDA STATUS IMEDIATAMENTE PARA EVITAR LOOP
      proximo.status = "processando"; 
      
      console.log("Iniciando processamento único para:", proximo.m3u);

      try {
        await executarBot(pedidos);
      } catch (e) {
        console.log("Erro no ciclo:", e.message);
      } finally {
        // Limpa da memória os pedidos que já deram OK
        pedidos = pedidos.filter(p => p.status !== "ok");
        botOcupado = false;
      }
    }
  }
}, 30000); // Tenta processar a cada 30 segundos

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Servidor rodando porta", PORT));
