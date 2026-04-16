const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");
const executarBot = require("./bot");

const app = express();
app.use(bodyParser.json());

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

app.post("/ativar", (req, res) => {
    const { mac, key, user, pass, limparTudo } = req.body;
    
    pedidos = pedidos.filter(p => p.mac !== mac);

    if (limparTudo) {
        // Se for LIMPAR, adicionamos apenas UM comando na fila
        pedidos.push({
            mac: mac.trim(),
            key: key.trim(),
            status: "pendente",
            somenteLimpar: true // Marca especial para o bot saber que não deve adicionar nada
        });
    } else {
        // Se for APENAS ATIVAR, segue o fluxo normal de 15 itens
        SERVIDORES.forEach((servidor) => {
            let nomePl = servidor.replace("http://", "").replace("https://", "").split('.')[0].toUpperCase();
            pedidos.push({
                mac: mac.trim(),
                key: key.trim(),
                m3u: `${servidor}/get.php?username=${user}&password=${pass}&type=m3u_plus`,
                nome: nomePl,
                status: "pendente",
                somenteLimpar: false
            });
        });
    }
    res.send({ ok: true });
});

app.get("/status", (req, res) => {
    const { mac } = req.query;
    const pedidoLimpeza = pedidos.find(p => p.mac === mac && p.somenteLimpar === true);
    
    if (pedidoLimpeza) {
        return res.json({ concluidos: 0, total: 1, status: "limpando" });
    }

    const restantes = pedidos.filter(p => p.mac === mac).length;
    res.json({ concluidos: 15 - restantes, total: 15, status: "processando" });
});

setInterval(async () => {
    if (!botOcupado) {
        const proximo = pedidos.find(p => p.status === "pendente");
        if (proximo) {
            botOcupado = true;
            try { await executarBot(pedidos); } 
            finally {
                pedidos = pedidos.filter(p => p.status !== "ok");
                botOcupado = false;
            }
        }
    }
}, 20000);

app.listen(process.env.PORT || 3000);
