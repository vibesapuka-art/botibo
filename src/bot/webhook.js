const { MongoClient } = require('mongodb');
const {
    enviarParaWhatsapp,
    enviarParaTodos
} = require('../services/push_service');

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

function normalizarTexto(texto) {
    return String(texto || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '_')
        .replace(/-/g, '_');
}

/**
 * Lê o endpoint/tipo enviado pelo Gestor.
 * Você já configurou os endpoints no Gestor como:
 * bem_vindo, fatura_criada, proximo_vencimento, vence_hoje,
 * vencido, pagamento_confirmado, aniversario, dados_cliente,
 * indicacao, mensagem_direta.
 */
function obterEndpointWebhook(d) {
    return normalizarTexto(
        d.endpoint ||
        d.webhook_endpoint ||
        d.nome_endpoint ||
        d.tipo_webhook ||
        d.push_tipo ||
        d.tipo ||
        d.evento ||
        d.nome_evento ||
        d.nome ||
        ''
    );
}

function obterMensagemBase(d, clienteData) {
    return String(
        d.mensagem ||
        d.msg ||
        d.texto ||
        d.message ||
        d.body ||
        d.descricao ||
        ''
    ).replace(/\{br\}/gi, '\n').trim();
}

function montarPushPorEndpoint(endpoint, d, clienteData) {
    const mensagemOriginal = obterMensagemBase(d, clienteData);

    const nome = clienteData.nome || 'Cliente Imperium';
    const valor = clienteData.valor || d.subtotal || d.valor_total || d.valor_plano || '';
    const vencimento = clienteData.vencimento || d.vencimento || '';
    const linkFatura = clienteData.link_fatura || d.link_fatura || d.fatura_link || d.url_fatura || '';
    const areaCliente = d.area_cliente || d.area_cliente_url || d.link_area_cliente || '/';

    switch (endpoint) {
        case 'bem_vindo':
            return {
                titulo: d.titulo || d.title || '👋 Bem-vindo à Imperium TV',
                mensagem: mensagemOriginal || `Olá ${nome}, seu acesso foi criado com sucesso.`,
                tipo: 'bem_vindo',
                url: areaCliente || '/'
            };

        case 'fatura_criada':
            return {
                titulo: d.titulo || d.title || '💳 Nova fatura disponível',
                mensagem: mensagemOriginal || `Olá ${nome}, sua fatura foi gerada${valor ? ` no valor de ${valor}` : ''}.`,
                tipo: 'fatura',
                url: linkFatura || areaCliente || '/'
            };

        case 'proximo_vencimento':
            return {
                titulo: d.titulo || d.title || '⏰ Fatura próxima do vencimento',
                mensagem: mensagemOriginal || `Olá ${nome}, sua fatura está próxima do vencimento${vencimento ? ` em ${vencimento}` : ''}.`,
                tipo: 'lembrete',
                url: linkFatura || areaCliente || '/'
            };

        case 'vence_hoje':
            return {
                titulo: d.titulo || d.title || '🚨 Sua fatura vence hoje',
                mensagem: mensagemOriginal || `Olá ${nome}, sua fatura vence hoje. Evite a suspensão do serviço.`,
                tipo: 'vence_hoje',
                url: linkFatura || areaCliente || '/'
            };

        case 'vencido':
            return {
                titulo: d.titulo || d.title || '❌ Fatura vencida',
                mensagem: mensagemOriginal || `Olá ${nome}, sua fatura está vencida. Regularize para manter seu acesso ativo.`,
                tipo: 'vencido',
                url: linkFatura || areaCliente || '/'
            };

        case 'pagamento_confirmado':
            return {
                titulo: d.titulo || d.title || '✅ Pagamento confirmado',
                mensagem: mensagemOriginal || `Olá ${nome}, seu pagamento foi confirmado com sucesso.`,
                tipo: 'pagamento',
                url: areaCliente || '/'
            };

        case 'aniversario':
            return {
                titulo: d.titulo || d.title || '🎂 Feliz aniversário!',
                mensagem: mensagemOriginal || `Parabéns, ${nome}! A Imperium TV deseja um dia maravilhoso para você.`,
                tipo: 'aniversario',
                url: areaCliente || '/'
            };

        case 'dados_cliente':
            return {
                titulo: d.titulo || d.title || '📋 Dados de acesso',
                mensagem: mensagemOriginal || `Olá ${nome}, seus dados de acesso estão disponíveis na central do cliente.`,
                tipo: 'dados',
                url: areaCliente || '/'
            };

        case 'indicacao':
            return {
                titulo: d.titulo || d.title || '🤝 Obrigado pela indicação',
                mensagem: mensagemOriginal || `Olá ${nome}, você recebeu uma atualização sobre sua indicação.`,
                tipo: 'indicacao',
                url: areaCliente || '/'
            };

        case 'mensagem_direta':
            return {
                titulo: d.titulo || d.title || '📢 Imperium TV',
                mensagem: mensagemOriginal || 'Você recebeu uma nova mensagem da Imperium TV.',
                tipo: 'mensagem',
                url: areaCliente || '/'
            };

        case 'mensagem_massa':
        case 'massa':
            return {
                titulo: d.titulo || d.title || '📢 Imperium TV',
                mensagem: mensagemOriginal || 'Você recebeu uma nova mensagem da Imperium TV.',
                tipo: 'massa',
                url: areaCliente || '/'
            };

        default:
            return {
                titulo: d.titulo || d.title || '📢 Imperium TV',
                mensagem: mensagemOriginal || 'Você recebeu uma nova notificação da Imperium TV.',
                tipo: 'mensagem',
                url: linkFatura || areaCliente || '/'
            };
    }
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
        const d = req.body || {};
        const endpoint = obterEndpointWebhook(d);

        console.log("📩 Webhook recebido do Gestor.");
        console.log("Endpoint detectado:", endpoint || "(vazio)");

        const whatsappLimpo = limparNumero(d.whatsapp);

        /**
         * Mensagem em massa:
         * se vier endpoint mensagem_massa/massa sem WhatsApp, envia para todos.
         */
        if (!whatsappLimpo && (endpoint === "mensagem_massa" || endpoint === "massa")) {
            const push = montarPushPorEndpoint(endpoint, d, {
                nome: "Cliente Imperium",
                whatsapp: ""
            });

            const resultado = await enviarParaTodos({
                titulo: push.titulo,
                mensagem: push.mensagem,
                tipo: push.tipo,
                url: push.url
            });

            console.log("📢 Push em massa enviado:", resultado);
            return res.status(200).send("OK MASSA");
        }

        if (!whatsappLimpo) {
            console.log("⚠️ Webhook recebido, mas sem campo WhatsApp.");
            return res.status(200).send("Recebido, mas sem WhatsApp");
        }

        const clienteData = {
            whatsapp: whatsappLimpo,
            nome: d.nome_cliente || d.nome || d.cliente || 'Cliente Imperium',
            usuario_iptv: d.usuario || d.usuario_iptv || d.login || '',
            senha_iptv: d.senha || d.senha_iptv || d.password || '',
            vencimento: d.vencimento || d.data_vencimento || d.expiracao || '',
            valor: d.valor_plano || d.valor || d.preco || d.subtotal || d.valor_total || '',
            servidor: d.nome_servidor || d.servidor || 'MultServidor',
            link_fatura: d.link_fatura || d.fatura_link || d.url_fatura || '',
            status_fatura: d.status_fatura || d.status || 'Pendente',
            ultimo_endpoint_webhook: endpoint || '',
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

        const push = montarPushPorEndpoint(endpoint, d, clienteData);

        const resultadoPush = await enviarParaWhatsapp({
            whatsapp: clienteData.whatsapp,
            titulo: push.titulo,
            mensagem: push.mensagem,
            tipo: push.tipo,
            url: push.url
        });

        console.log(`🔔 Push enviado para ${clienteData.whatsapp}:`, resultadoPush);

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
