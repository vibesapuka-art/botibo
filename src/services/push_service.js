const webpush = require("web-push");
const admin = require("firebase-admin");
const { MongoClient } = require("mongodb");

const MONGO_URI = process.env.MONGO_URI || process.env.MONGO_URL;
const MONGO_DB_NAME = process.env.MONGO_DB_NAME || "ImperiumDB";
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_EMAIL = process.env.VAPID_EMAIL || "mailto:imperiumtv@email.com";

let client;
let db;
let firebaseInicializado = false;

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

function configurarFirebaseAdmin() {
    if (firebaseInicializado || admin.apps.length > 0) {
        firebaseInicializado = true;
        return admin;
    }

    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

    if (!serviceAccountJson) {
        throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON não configurada.");
    }

    let serviceAccount;

    try {
        serviceAccount = JSON.parse(serviceAccountJson);
    } catch (err) {
        throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON inválida. Copie o JSON completo da chave privada.");
    }

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });

    firebaseInicializado = true;
    console.log("✅ Firebase Admin inicializado.");
    return admin;
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
        origem: "web",
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

async function salvarTokenApp({ whatsapp, token, plataforma = "android", userAgent = "" }) {
    const database = await conectarMongo();
    const collection = database.collection("app_push_tokens");

    const numeroLimpo = limparNumero(whatsapp);
    const whatsappFinal = numeroLimpo.slice(-8);

    if (!whatsappFinal) throw new Error("WhatsApp inválido.");
    if (!token) throw new Error("Token Firebase obrigatório.");

    const dados = {
        whatsapp: numeroLimpo,
        whatsappFinal,
        token,
        plataforma,
        userAgent: userAgent || "",
        origem: "app",
        ativo: true,
        atualizadoEm: new Date()
    };

    await collection.updateOne(
        { token },
        { $set: dados, $setOnInsert: { criadoEm: new Date() } },
        { upsert: true }
    );

    console.log(`📲 Token Firebase salvo para ${numeroLimpo} final ${whatsappFinal}`);

    return dados;
}

async function criarNotificacao({
    titulo,
    mensagem,
    tipo = "geral",
    whatsapp = "",
    url = "/",
    formatoMensagem = "padrao"
}) {
    const database = await conectarMongo();
    const collection = database.collection("notificacoes");

    const numero = limparNumero(whatsapp);

    const doc = {
        titulo,
        mensagem,
        tipo,
        formatoMensagem,
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

async function enviarPushFirebase(token, { titulo, mensagem, tipo = "geral", url = "/" }) {
    configurarFirebaseAdmin();

    const message = {
        token,
        notification: {
            title: titulo || "Imperium TV",
            body: mensagem || "Você tem uma nova notificação."
        },
        data: {
            tipo: String(tipo || "geral"),
            url: String(url || "/")
        },
        android: {
            priority: "high",
            notification: {
                sound: "default",
                defaultSound: true,
                defaultVibrateTimings: true
            }
        }
    };

    return admin.messaging().send(message);
}

async function buscarTokensAppPorWhatsapp(appCollection, whatsappFinal) {
    const encontradosAtivos = await appCollection.find({
        whatsappFinal,
        ativo: true
    }).toArray();

    if (encontradosAtivos.length > 0) {
        return encontradosAtivos;
    }

    console.log("⚠️ Nenhum token ativo encontrado com filtro exato. Tentando busca alternativa...");

    const todos = await appCollection.find({}).toArray();

    const filtrados = todos.filter((item) => {
        const finalBanco = limparNumero(item.whatsappFinal || item.whatsapp || "").slice(-8);
        const ativoValido = item.ativo === true || item.ativo === "true" || item.ativo === 1 || item.ativo === undefined;
        return finalBanco === whatsappFinal && ativoValido && item.token;
    });

    console.log(`🔎 Tokens app encontrados na busca alternativa: ${filtrados.length}`);

    return filtrados;
}

async function enviarParaTodos({ titulo, mensagem, tipo = "geral", url = "/" }) {
    const database = await conectarMongo();

    const webCollection = database.collection("push_subscriptions");
    const appCollection = database.collection("app_push_tokens");

    const inscritosWeb = await webCollection.find({ ativo: true }).toArray();
    const inscritosApp = await appCollection.find({ ativo: true }).toArray();

    const payloadWeb = {
        title: titulo,
        body: mensagem,
        icon: "/logo.png",
        badge: "/logo.png",
        url,
        tipo,
        formatoMensagem: "livre"
    };

    let enviadosWeb = 0;
    let falhasWeb = 0;
    let enviadosApp = 0;
    let falhasApp = 0;

    await criarNotificacao({
        titulo,
        mensagem,
        tipo,
        url,
        formatoMensagem: "livre"
    });

    console.log(`📣 Envio geral: web=${inscritosWeb.length}, app=${inscritosApp.length}`);

    for (const item of inscritosWeb) {
        try {
            await enviarPush(item.subscription, payloadWeb);
            enviadosWeb++;
        } catch (err) {
            falhasWeb++;
            console.error("Erro push web:", err.statusCode || err.message);

            if (err.statusCode === 404 || err.statusCode === 410) {
                await webCollection.updateOne(
                    { endpoint: item.endpoint },
                    { $set: { ativo: false, erro: err.message, atualizadoEm: new Date() } }
                );
            }
        }
    }

    for (const item of inscritosApp) {
        try {
            await enviarPushFirebase(item.token, { titulo, mensagem, tipo, url });
            enviadosApp++;
        } catch (err) {
            falhasApp++;
            console.error("Erro push app:", err.code || err.message);

            if (
                err.code === "messaging/registration-token-not-registered" ||
                err.code === "messaging/invalid-registration-token"
            ) {
                await appCollection.updateOne(
                    { token: item.token },
                    { $set: { ativo: false, erro: err.message, atualizadoEm: new Date() } }
                );
            }
        }
    }

    return {
        web: {
            total: inscritosWeb.length,
            enviados: enviadosWeb,
            falhas: falhasWeb
        },
        app: {
            total: inscritosApp.length,
            enviados: enviadosApp,
            falhas: falhasApp
        }
    };
}

async function enviarParaWhatsapp({ whatsapp, titulo, mensagem, tipo = "individual", url = "/" }) {
    const database = await conectarMongo();

    const webCollection = database.collection("push_subscriptions");
    const appCollection = database.collection("app_push_tokens");

    const whatsappLimpo = limparNumero(whatsapp);
    const whatsappFinal = whatsappLimpo.slice(-8);

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🔔 Envio individual solicitado");
    console.log("WhatsApp recebido:", whatsapp);
    console.log("WhatsApp limpo:", whatsappLimpo);
    console.log("Final usado na busca:", whatsappFinal);

    const inscritosWeb = await webCollection.find({ whatsappFinal, ativo: true }).toArray();
    const inscritosApp = await buscarTokensAppPorWhatsapp(appCollection, whatsappFinal);

    console.log("Web encontrados:", inscritosWeb.length);
    console.log("App encontrados:", inscritosApp.length);

    if (inscritosApp.length > 0) {
        console.log("Primeiro token app final:", inscritosApp[0].whatsappFinal);
        console.log("Primeiro token app ativo:", inscritosApp[0].ativo);
        console.log("Primeiro token app plataforma:", inscritosApp[0].plataforma);
    }

    const payloadWeb = {
        title: titulo,
        body: mensagem,
        icon: "/logo.png",
        badge: "/logo.png",
        url,
        tipo,
        formatoMensagem: tipo === "massa" || tipo === "geral" ? "livre" : "padrao"
    };

    let enviadosWeb = 0;
    let falhasWeb = 0;
    let enviadosApp = 0;
    let falhasApp = 0;

    await criarNotificacao({
        titulo,
        mensagem,
        tipo,
        whatsapp,
        url,
        formatoMensagem: tipo === "massa" || tipo === "geral" ? "livre" : "padrao"
    });

    for (const item of inscritosWeb) {
        try {
            await enviarPush(item.subscription, payloadWeb);
            enviadosWeb++;
        } catch (err) {
            falhasWeb++;
            console.error("Erro push web individual:", err.statusCode || err.message);

            if (err.statusCode === 404 || err.statusCode === 410) {
                await webCollection.updateOne(
                    { endpoint: item.endpoint },
                    { $set: { ativo: false, erro: err.message, atualizadoEm: new Date() } }
                );
            }
        }
    }

    for (const item of inscritosApp) {
        try {
            const respostaFirebase = await enviarPushFirebase(item.token, { titulo, mensagem, tipo, url });
            console.log("✅ Firebase enviado:", respostaFirebase);
            enviadosApp++;
        } catch (err) {
            falhasApp++;
            console.error("❌ Erro push app individual:", err.code || err.message);
            console.error(err);

            if (
                err.code === "messaging/registration-token-not-registered" ||
                err.code === "messaging/invalid-registration-token"
            ) {
                await appCollection.updateOne(
                    { token: item.token },
                    { $set: { ativo: false, erro: err.message, atualizadoEm: new Date() } }
                );
            }
        }
    }

    const resultado = {
        web: {
            total: inscritosWeb.length,
            enviados: enviadosWeb,
            falhas: falhasWeb
        },
        app: {
            total: inscritosApp.length,
            enviados: enviadosApp,
            falhas: falhasApp
        }
    };

    console.log("Resultado envio:", JSON.stringify(resultado, null, 2));
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    return resultado;
}

async function listarNotificacoesCliente(whatsapp) {
    const database = await conectarMongo();
    const collection = database.collection("notificacoes");

    const whatsappFinal = limparNumero(whatsapp).slice(-8);

    return collection
        .find({
            $or: [
                { tipo: "geral" },
                { tipo: "massa" },
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
    salvarTokenApp,
    enviarParaTodos,
    enviarParaWhatsapp,
    listarNotificacoesCliente,
    criarNotificacao
};
