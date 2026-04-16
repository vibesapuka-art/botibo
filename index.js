const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const dnsConfig = require("./dns");
const executarBot = require("./bot");

const app = express();

// Middleware para entender JSON e servir a pasta do Painel Web
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// Variáveis de controle da fila
let pedidos = [];
let botOcupado = false;

// Rota principal para carregar o Painel Web (Front-end)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Rota que recebe os dados do formulário do cliente
app.post("/ativar", (req, res) => {
  const { mac, key, user, pass } = req.body;

  // Validação básica de entrada
  if (!mac || !key || !user || !pass) {
    return res.status(400).send({ erro: "Dados incompletos. Preencha todos os campos." });
  }

  // Adiciona todos os servidores da lista DNS para este pedido
  dnsConfig.servidores.forEach((servidor) => {
    // Extrai o nome do servidor (ex: cbr) para usar na playlist
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

  console.log(`[FILA] Novo pedido adicionado para o MAC: ${mac} (${dnsConfig.servidores.length} DNS)`);
  res.send({ ok: true, mensagem: "Pedido enviado para a fila de processamento." });
});

/**
 * Loop de processamento inteligente
 * Roda a cada 30 segundos verificando se há pedidos pendentes.
 */
setInterval(async () => {
  // Só inicia se o bot não estiver ocupado e houver algo na fila
  if (!botOcupado) {
    const proximo = pedidos.find(p => p.status === "pendente");

    if (proximo) {
      botOcupado = true;
      
      // MUDA O STATUS IMEDIATAMENTE
      // Isso impede que o loop selecione o mesmo pedido antes do bot terminar
      proximo.status = "processando"; 
      
      console.log(`[EXECUTOR] Iniciando bot para: ${proximo.nome} no MAC ${proximo.mac}`);

      try {
        // Passa a lista de pedidos para o bot processar o atual
        await executarBot(pedidos);
      } catch (e) {
        console.log("[ERRO] Falha crítica no ciclo do bot:", e.message);
        // Em caso de falha grave, volta para pendente para tentar novamente
        if (proximo.status === "processando") {
            proximo.status = "pendente";
        }
      } finally {
        // Limpa da memória apenas os pedidos que foram concluídos com sucesso (status "ok")
        pedidos = pedidos.filter(p => p.status !== "ok");
        botOcupado = false;
        console.log(`[FILA] Processamento finalizado. Pedidos restantes na fila: ${pedidos.length}`);
      }
    }
  }
}, 30000); 

// Inicialização do Servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("-----------------------------------------");
  console.log(`🚀 SERVIDOR RODANDO NA PORTA ${PORT}`);
  console.log(`💻 ACESSE O PAINEL: http://localhost:${PORT}`);
  console.log("-----------------------------------------");
});
