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
    "XW", "MEUSRV", "PRD", "SOLAR", "ATBX", "ATN", "OD", "ECPS", 
    "TITA", "VR766", "HADES", "IFX", "NTB", "FLASH", "OLYMPUS"
];

app.post("/ativar", (req, res) => {
    const { mac, key, user, pass, limparTudo } = req.body;
    pedidos = pedidos.filter(p => p.mac !== mac);

    SERVIDORES.forEach((nomeServidor) => {
        pedidos.push({
            mac: mac.trim(),
            key: key.trim(),
            // Se for limpar, não precisa de m3u, só o nome para o bot achar e apagar
            m3u: limparTudo ? "" : `http://link-do-servidor/get.php?username=${user}&password=${pass}&type=m3u_plus`,
            nome: nomeServidor,
            status: "pendente",
            acao: limparTudo ? "EXCLUIR" : "ADICIONAR"
        });
    });

    console.log(`[FILA] Pedido de ${limparTudo ? 'LIMPEZA' : 'ATIVAÇÃO'} para ${mac} (15 etapas)`);
    res.send({ ok: true });
});

app.get("/status", (req, res) => {
    const { mac } = req.query;
    const restantes = pedidos.filter(p => p.mac === mac).length;
    res.json({ concluidos: 15 - restantes, total: 15 });
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
}, 12000); // Reduzi para 12s para a limpeza ser mais rápida

app.listen(process.env.PORT || 3000);
