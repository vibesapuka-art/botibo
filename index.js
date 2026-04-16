const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");
const executarBot = require("./bot");

const app = express();
app.use(bodyParser.json());

// Força a leitura da pasta public correta
const pastaPublic = fs.existsSync(path.join(__dirname, "public")) ? "public" : "Public";
app.use(express.static(path.join(__dirname, pastaPublic)));

let pedidos = [];
let botOcupado = false;

const SERVIDORES = [
    "http://xw.pluss.fun", "http://meusrv.top:80", "http://prd.blc-atena.com",
    "http://solar.playblc.work", "http://atbx.blc-atena.com", "http://atn.blc-atena.com",
    "http://od.blc-atena.com", "http://ecps.blc-atena.com", "http://tita.playblc.work",
    "http://vr766.com", "http://hades.blcplay2.work", "http://ifx.blc-atena.com",
    "http://ntb.blc-atena.com", "http://flash.netpl4y.com", "http://olympus.netpl4y.com"
];

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, pastaPublic, "index.html"));
});

app.post("/ativar", (req, res) => {
    const { mac, key, user, pass, limparTudo } = req.body;
    if (!mac || !key || !user || !pass) return res.status(400).send({ erro: "Dados incompletos" });

    // Remove qualquer pedido pendente antigo deste mesmo MAC para evitar duplicados na fila
    pedidos = pedidos.filter(p => p.mac !== mac);

    SERVIDORES.forEach((servidor, index) => {
        let nomePl = "";
        try {
            nomePl = servidor.replace("http://", "").replace("https://", "").split('.')[0].toUpperCase();
        } catch (e) { nomePl = "IPTV"; }

        pedidos.push({
            mac: mac.trim(),
            key: key.trim(),
            m3u: `${servidor}/get.php?username=${user}&password=${pass}&type=m3u_plus`,
            nome: nomePl,
            status: "pendente",
            limpar: (limparTudo === true && index === 0) 
        });
    });

    console.log(`[FILA] MAC ${mac} adicionado. Limpeza seletiva: ${limparTudo}`);
    res.send({ ok: true });
});

app.get("/status", (req, res) => {
    const { mac } = req.query;
    const total = SERVIDORES.length;
    
    const erroLogin = pedidos.find(p => p.mac === mac && p.status === "erro_login");
    const restantes = pedidos.filter(p => p.mac === mac).length;
    const concluidos = total - restantes;

    res.json({
        concluidos: concluidos >= 0 ? concluidos : 0,
        total: total,
        status: erroLogin ? "erro_login" : "processando"
    });
});

setInterval(async () => {
    if (!botOcupado) {
        const proximo = pedidos.find(p => p.status === "pendente");
        if (proximo) {
            botOcupado = true;
            try {
                await executarBot(pedidos);
            } finally {
                pedidos = pedidos.filter(p => p.status !== "ok");
                botOcupado = false;
            }
        }
    }
}, 20000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor pronto na porta ${PORT}`));
