const { MongoClient } = require("mongodb");

const MONGO_URI = process.env.MONGO_URI || process.env.MONGO_URL;
const MONGO_DB_NAME = process.env.MONGO_DB_NAME || "ImperiumDB";

let client;
let db;

async function conectarMongo() {
    if (db) return db;

    if (!MONGO_URI) {
        throw new Error("MONGO_URI ou MONGO_URL não configurada no Render.");
    }

    client = new MongoClient(MONGO_URI);
    await client.connect();

    db = client.db(MONGO_DB_NAME);
    return db;
}

function normalizarDns(dns) {
    if (!dns) return "";

    let url = String(dns).trim().replace(/\/+$/, "");

    if (!url.startsWith("http://") && !url.startsWith("https://")) {
        url = "http://" + url;
    }

    return url;
}

async function buscarDnsAtivasMongo() {
    const database = await conectarMongo();

    const docs = await database
        .collection("dns_ativas")
        .find({ status: "ativa" })
        .sort({
            prioridade: 1,
            atualizadoEm: -1
        })
        .toArray();

    return docs
        .map(item => normalizarDns(item.dns))
        .filter(Boolean);
}

/**
 * Agora NÃO revalida via player_api.php.
 * O Streamlit já validou e salvou no MongoDB.
 * Aqui só busca as DNS ativas e sorteia a quantidade necessária para o IB.
 */
async function buscarDnsValidadasParaIb(username, password, limite = 5) {
    const todasDns = await buscarDnsAtivasMongo();

    if (!todasDns || todasDns.length === 0) {
        throw new Error("Nenhuma DNS ativa encontrada no MongoDB.");
    }

    const embaralhadas = [...todasDns].sort(() => 0.5 - Math.random());
    const selecionadas = embaralhadas.slice(0, limite);

    console.log("✅ DNS selecionadas do MongoDB para o IB:", selecionadas);

    return selecionadas;
}

module.exports = {
    buscarDnsAtivasMongo,
    buscarDnsValidadasParaIb
};
