const express = require("express");
const bodyParser = require("body-parser");
const dnsConfig = require("./dns");
const executarBot = require("./bot");

const app = express();
app.use(bodyParser.json());

let pedidos = [];

app.post("/ativar", (req, res) => {
  const { mac, key, user, pass } = req.body;

  if (!mac || !key || !user || !pass) {
    return res.status(400).send({ erro: "Dados incompletos" });
  }

  // Pega a lista real do seu arquivo dns.js
  const listaDNS = dnsConfig.servidores;

  // Adiciona cada DNS como um pedido separado
  listaDNS.forEach((servidor) => {
    const m3u = `${servidor}/get.php?username=${user}&password=${pass}&type=m3u_plus`;
    
    pedidos.push({
      mac,
      key,
      m3u,
      nome: user, // O nome da playlist no painel
      status: "pendente"
    });
  });

  console.log(`FILA ATUALIZADA: ${listaDNS.length} novos DNS para o MAC ${mac}`);
  res.send({ ok: true, total: listaDNS.length });
});

// Loop que processa a fila
setInterval(async () => {
  // Filtra apenas o que ainda não foi feito
  const pendentes = pedidos.filter(p => p.status === "pendente");
  
  if (pendentes.length > 0) {
    // Processa apenas o primeiro da fila para não sobrecarregar
    await executarBot(pedidos);
    
    // Limpa da memória o que já deu certo para não repetir
    pedidos = pedidos.filter(p => p.status !== "ok");
  }
}, 45000); // Intervalo de 45 segundos entre cada cadastro

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Servidor ativo na porta", PORT));
