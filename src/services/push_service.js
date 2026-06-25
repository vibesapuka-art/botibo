const webpush = require("web-push");
const { MongoClient } = require("mongodb");

const MONGO_URI = process.env.MONGO_URI || process.env.MONGO_URL;
const MONGO_DB_NAME = process.env.MONGO_DB_NAME || "ImperiumDB";
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_EMAIL = process.env.VAPID_EMAIL || "mailto:imperiumtv@email.com";

let client;
let db;

function limparNumero(numero) {
    return String(numero || "").replace(/\D/g, "");
}

async function conectarMongo() {
    if (db) return db;

    if (!MONGO_URI) {
        throw new Error("MONGO_URI ou MONGO_URL não configurada.");
    }

    client = new MongoClient(MONGO_URI);
    await client.connect();

    db = client.db(MONGO_DB_NAME);
    return db;
}

function configurarWebPush() {
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
        throw new Error("VAPID_PUBLIC_KEY ou VAPID_PRIVATE_KEY não configurada.");
    }

    webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

async function salvarInscricaoPush({ whatsapp, subscription, userAgent }) {
    const database = await conectarMongo();
    const collection = database.collection("push_subscriptions");

    const numeroLimpo = limparNumero(whatsapp);
    const whatsappFinal = numeroLimpo.slice(-8);

    if (!whatsappFinal) throw new Error("WhatsApp inválido.");
    if (!subscription || !subscription.endpoint) throw new Error("Subscription inválida.");

    const dados = {
        whatsapp: numeroLimpo,
        whatsappFinal,
        endpoint: subscription.endpoint,
        subscription,
        userAgent: userAgent || "",
        ativo: true,
        atualizadoEm: new Date()
    };

    await collection.updateOne(
        { endpoint: subscription.endpoint },
        { $set: dados, $setOnInsert: { criadoEm: new Date() } },
        { upsert: true }
    );

    return dados;
}

async function criarNotificacao({ titulo, mensagem, tipo = "geral", whatsapp = "", url = "/" }) {
    const database = await conectarMongo();
    const collection = database.collection("notificacoes");

    const numero = limparNumero(whatsapp);

    const doc = {
        titulo,
        mensagem,
        tipo,
        whatsapp: numero,
        whatsappFinal: numero.slice(-8),
        url,
        lida: false,
        criadoEm: new Date()
    };

    await collection.insertOne(doc);
    return doc;
}

async function enviarPush(subscription, payload) {
    configurarWebPush();
    return webpush.sendNotification(subscription, JSON.stringify(payload));
}

async function enviarParaTodos({ titulo, mensagem, tipo = "geral", url = "/" }) {
    const database = await conectarMongo();
    const collection = database.collection("push_subscriptions");

    const inscritos = await collection.find({ ativo: true }).toArray();

    const payload = {
        title: titulo,
        body: mensagem,
        icon: "/logo.png",
        badge: "/logo.png",
        url,
        tipo
    };

    let enviados = 0;
    let falhas = 0;

    await criarNotificacao({ titulo, mensagem, tipo, url });

    for (const item of inscritos) {
        try {
            await enviarPush(item.subscription, payload);
            enviados++;
        } catch (err) {
            falhas++;
            console.error("Erro push:", err.statusCode || err.message);

            if (err.statusCode === 404 || err.statusCode === 410) {
                await collection.updateOne(
                    { endpoint: item.endpoint },
                    { $set: { ativo: false, erro: err.message, atualizadoEm: new Date() } }
                );
            }
        }
    }

    return { total: inscritos.length, enviados, falhas };
}

async function enviarParaWhatsapp({ whatsapp, titulo, mensagem, tipo = "individual", url = "/" }) {
    const database = await conectarMongo();
    const collection = database.collection("push_subscriptions");

    const whatsappFinal = limparNumero(whatsapp).slice(-8);

    const inscritos = await collection.find({ whatsappFinal, ativo: true }).toArray();

    const payload = {
        title: titulo,
        body: mensagem,
        icon: "/logo.png",
        badge: "/logo.png",
        url,
        tipo
    };

    let enviados = 0;
    let falhas = 0;

    await criarNotificacao({ titulo, mensagem, tipo, whatsapp, url });

    for (const item of inscritos) {
        try {
            await enviarPush(item.subscription, payload);
            enviados++;
        } catch (err) {
            falhas++;
            console.error("Erro push individual:", err.statusCode || err.message);

            if (err.statusCode === 404 || err.statusCode === 410) {
                await collection.updateOne(
                    { endpoint: item.endpoint },
                    { $set: { ativo: false, erro: err.message, atualizadoEm: new Date() } }
                );
            }
        }
    }

    return { total: inscritos.length, enviados, falhas };
}

async function listarNotificacoesCliente(whatsapp) {
    const database = await conectarMongo();
    const collection = database.collection("notificacoes");

    const whatsappFinal = limparNumero(whatsapp).slice(-8);

    return collection
        .find({
            $or: [
                { tipo: "geral" },
                { whatsappFinal }
            ]
        })
        .sort({ criadoEm: -1 })
        .limit(30)
        .toArray();
}

module.exports = {
    VAPID_PUBLIC_KEY,
    salvarInscricaoPush,
    enviarParaTodos,
    enviarParaWhatsapp,
    listarNotificacoesCliente,
    criarNotificacao
};

