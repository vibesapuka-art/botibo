const { MongoClient } = require('mongodb');

const uri = process.env.MONGO_URL || process.env.MONGO_URI;
const DB_NAME = process.env.MONGO_DB_NAME || 'ImperiumDB';

function limparNumero(numero) {
    return String(numero || '').replace(/\D/g, '');
}

function limparMac(mac) {
    return String(mac || '').trim();
}

function limparKey(key) {
    return String(key || '').trim();
}

/**
 * Busca dispositivo primeiro em dispositivos_clientes.
 * Se não achar, busca em testes_ib.
 */
async function buscarDispositivoPorWhatsapp(db, finalBusca) {
    const colecaoDispositivos = db.collection("dispositivos_clientes");
    const colecaoTestes = db.collection("testes_ib");

    let dispositivo = await colecaoDispositivos.findOne({
        whatsappFinal: finalBusca
    });

    if (dispositivo && dispositivo.mac && dispositivo.key) {
        return {
            mac: limparMac(dispositivo.mac),
            key: limparKey(dispositivo.key),
            origem_dispositivo: "dispositivos_clientes"
        };
    }

    const teste = await colecaoTestes.findOne(
        {
            whatsapp: { $regex: finalBusca + "$" },
            mac: { $exists: true, $ne: "" },
            key: { $exists: true, $ne: "" }
        },
        {
            sort: {
                atualizadoEm: -1,
                data: -1,
                criadoEm: -1,
                _id: -1
            }
        }
    );

    if (teste && teste.mac && teste.key) {
        return {
            mac: limparMac(teste.mac),
            key: limparKey(teste.key),
            origem_dispositivo: "testes_ib"
        };
    }

    return {
        mac: "",
        key: "",
        origem_dispositivo: ""
    };
}

/**
 * Busca cliente + MAC/KEY salvo.
 */
async function consultarCliente(numeroWhatsApp) {
    if (!uri) {
        throw new Error("MONGO_URL ou MONGO_URI não configurada.");
    }

    const client = new MongoClient(uri);

    try {
        const numeroLimpo = limparNumero(numeroWhatsApp);
        const finalBusca = numeroLimpo.slice(-8);

        await client.connect();

        const db = client.db(DB_NAME);
        const colecaoClientes = db.collection("clientes");

        console.log(`🔍 Buscando cliente que termine com: ${finalBusca}`);

        const cliente = await colecaoClientes.findOne({
            whatsapp: { $regex: finalBusca + "$" }
        });

        if (!cliente) {
            return null;
        }

        const dispositivo = await buscarDispositivoPorWhatsapp(db, finalBusca);

        return {
            ...cliente,
            mac: dispositivo.mac,
            key: dispositivo.key,
            origem_dispositivo: dispositivo.origem_dispositivo,
            dispositivo_salvo: !!(dispositivo.mac && dispositivo.key)
        };

    } catch (err) {
        console.error("❌ Erro ao consultar MongoDB:", err.message);
        throw err;
    } finally {
        await client.close();
    }
}

/**
 * Salva ou atualiza MAC/KEY oficial do cliente.
 */
async function salvarDispositivoCliente({ whatsapp, mac, key, tipo }) {
    if (!uri) {
        throw new Error("MONGO_URL ou MONGO_URI não configurada.");
    }

    const numeroLimpo = limparNumero(whatsapp);
    const finalBusca = numeroLimpo.slice(-8);

    if (!finalBusca || !mac || !key) {
        return {
            success: false,
            mensagem: "WhatsApp, MAC ou KEY ausentes."
        };
    }

    const client = new MongoClient(uri);

    try {
        await client.connect();

        const db = client.db(DB_NAME);
        const colecao = db.collection("dispositivos_clientes");

        const dados = {
            whatsapp: numeroLimpo,
            whatsappFinal: finalBusca,
            mac: limparMac(mac),
            key: limparKey(key),
            tipo: tipo || "assinante",
            atualizadoEm: new Date()
        };

        await colecao.updateOne(
            { whatsappFinal: finalBusca },
            {
                $set: dados,
                $setOnInsert: {
                    criadoEm: new Date()
                }
            },
            { upsert: true }
        );

        console.log(`💾 Dispositivo salvo para final ${finalBusca}: ${dados.mac}`);

        return {
            success: true,
            dados
        };

    } catch (err) {
        console.error("❌ Erro ao salvar dispositivo:", err.message);
        throw err;
    } finally {
        await client.close();
    }
}

/**
 * Função que recebe os dados do GestorV3 via POST
 */
async function processarWebhook(req, res) {
    if (!uri) {
        console.error("❌ Erro: Variável MONGO_URL/MONGO_URI não definida no ambiente.");
        return res.status(500).send("Sem URL do Banco");
    }

    const client = new MongoClient(uri);

    try {
        const d = req.body;

        if (!d.whatsapp) {
            console.log("⚠️ Webhook recebido, mas sem campo WhatsApp.");
            return res.status(200).send("Recebido, mas sem WhatsApp");
        }

        const clienteData = {
            whatsapp: limparNumero(d.whatsapp),
            nome: d.nome_cliente || d.nome || d.cliente || 'Cliente Imperium',
            usuario_iptv: d.usuario || d.usuario_iptv || d.login || '',
            senha_iptv: d.senha || d.senha_iptv || d.password || '',
            vencimento: d.vencimento || d.data_vencimento || d.expiracao || '',
            valor: d.valor_plano || d.valor || d.preco || '',
            servidor: d.nome_servidor || d.servidor || 'MultServidor',
            link_fatura: d.link_fatura || d.fatura_link || d.url_fatura || '',
            status_fatura: d.status_fatura || d.status || 'Pendente',
            data_atualizacao: new Date()
        };

        await client.connect();

        const db = client.db(DB_NAME);
        const colecao = db.collection("clientes");

        await colecao.updateOne(
            { whatsapp: clienteData.whatsapp },
            { $set: clienteData },
            { upsert: true }
        );

        console.log(`✅ Sucesso: Cliente ${clienteData.whatsapp} (${clienteData.nome}) salvo no banco.`);

        return res.status(200).send("OK");

    } catch (err) {
        console.error("❌ Erro crítico no processamento do Webhook:", err.message);
        return res.status(500).send("Erro interno: " + err.message);
    } finally {
        await client.close();
    }
}

module.exports = {
    processarWebhook,
    consultarCliente,
    salvarDispositivoCliente
};
