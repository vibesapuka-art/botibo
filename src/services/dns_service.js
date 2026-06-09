const axios = require("axios");
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
        .sort({ prioridade: 1, atualizadoEm: -1 })
        .toArray();

    return docs
        .map(item => normalizarDns(item.dns))
        .filter(Boolean);
}

async function validarDnsAntesDoIb(dns, username, password, timeout = 8000) {
    const dnsNormalizada = normalizarDns(dns);

    if (!dnsNormalizada || !username || !password) {
        return {
            ativa: false,
            dns: dnsNormalizada,
            erro: "Dados incompletos"
        };
    }

    const urlApi = `${dnsNormalizada}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
    const urlM3u = `${dnsNormalizada}/get.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&type=m3u_plus&output=mpegts`;
    const urlCanais = `${dnsNormalizada}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=get_live_streams`;

    try {
        const responseApi = await axios.get(urlApi, {
            timeout,
            validateStatus: () => true
        });

        if (responseApi.status !== 200) {
            return {
                ativa: false,
                dns: dnsNormalizada,
                erro: `API HTTP ${responseApi.status}`
            };
        }

        const data = responseApi.data;
        const userInfo = data && data.user_info ? data.user_info : {};

        if (Number(userInfo.auth) !== 1) {
            return {
                ativa: false,
                dns: dnsNormalizada,
                erro: "Auth inválido"
            };
        }

        const statusUser = String(userInfo.status || "").toLowerCase();

        if (["disabled", "banned", "expired"].includes(statusUser)) {
            return {
                ativa: false,
                dns: dnsNormalizada,
                erro: `Status inválido: ${statusUser}`
            };
        }

        const responseM3u = await axios.get(urlM3u, {
            timeout,
            responseType: "text",
            maxContentLength: 1024 * 100,
            validateStatus: () => true
        });

        if (responseM3u.status !== 200 || !String(responseM3u.data).includes("#EXTM3U")) {
            return {
                ativa: false,
                dns: dnsNormalizada,
                erro: "M3U não abriu corretamente"
            };
        }

        const responseCanais = await axios.get(urlCanais, {
            timeout,
            validateStatus: () => true
        });

        if (responseCanais.status !== 200 || !Array.isArray(responseCanais.data) || responseCanais.data.length < 5) {
            return {
                ativa: false,
                dns: dnsNormalizada,
                erro: "Sem canais suficientes"
            };
        }

        return {
            ativa: true,
            dns: dnsNormalizada,
            totalCanais: responseCanais.data.length
        };

    } catch (error) {
        return {
            ativa: false,
            dns: dnsNormalizada,
            erro: error.message
        };
    }
}

async function buscarDnsValidadasParaIb(username, password, limite = 5) {
    const todasDns = await buscarDnsAtivasMongo();

    const embaralhadas = [...todasDns].sort(() => 0.5 - Math.random());
    const aprovadas = [];

    for (const dns of embaralhadas) {
        if (aprovadas.length >= limite) break;

        const resultado = await validarDnsAntesDoIb(dns, username, password);

        if (resultado.ativa) {
            aprovadas.push(resultado.dns);
        } else {
            console.log(`⚠️ DNS reprovada antes do IB: ${resultado.dns} | ${resultado.erro}`);
        }
    }

    return aprovadas;
}

module.exports = {
    buscarDnsAtivasMongo,
    validarDnsAntesDoIb,
    buscarDnsValidadasParaIb
};
