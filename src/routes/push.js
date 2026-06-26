const express = require("express");

const {
    VAPID_PUBLIC_KEY,
    salvarInscricaoPush,
    salvarTokenApp,
    enviarParaTodos,
    enviarParaWhatsapp,
    listarNotificacoesCliente
} = require("../services/push_service");

const router = express.Router();

router.get("/public-key", (req, res) => {
    if (!VAPID_PUBLIC_KEY) {
        return res.status(500).json({
            success: false,
            mensagem: "VAPID_PUBLIC_KEY não configurada."
        });
    }

    return res.json({
        success: true,
        publicKey: VAPID_PUBLIC_KEY
    });
});

/**
 * Inscrição Web Push antiga.
 * Usada por navegador/PWA.
 */
router.post("/subscribe", async (req, res) => {
    try {
        const { whatsapp, subscription } = req.body;

        if (!whatsapp) {
            return res.json({
                success: false,
                mensagem: "WhatsApp obrigatório."
            });
        }

        if (!subscription) {
            return res.json({
                success: false,
                mensagem: "Subscription obrigatória."
            });
        }

        const salvo = await salvarInscricaoPush({
            whatsapp,
            subscription,
            userAgent: req.headers["user-agent"] || ""
        });

        return res.json({
            success: true,
            mensagem: "Notificações web ativadas com sucesso.",
            dados: salvo
        });

    } catch (err) {
        console.error("Erro ao salvar push web:", err.message);

        return res.status(500).json({
            success: false,
            mensagem: err.message
        });
    }
});

/**
 * Token Firebase do aplicativo Android.
 * Usado pelo APK oficial da Imperium TV.
 */
router.post("/app-token", async (req, res) => {
    try {
        const {
            whatsapp,
            token,
            plataforma
        } = req.body;

        if (!whatsapp) {
            return res.json({
                success: false,
                mensagem: "WhatsApp obrigatório."
            });
        }

        if (!token) {
            return res.json({
                success: false,
                mensagem: "Token Firebase obrigatório."
            });
        }

        const salvo = await salvarTokenApp({
            whatsapp,
            token,
            plataforma: plataforma || "android",
            userAgent: req.headers["user-agent"] || ""
        });

        return res.json({
            success: true,
            mensagem: "Token do app salvo com sucesso.",
            dados: salvo
        });

    } catch (err) {
        console.error("Erro ao salvar token Firebase do app:", err.message);

        return res.status(500).json({
            success: false,
            mensagem: err.message
        });
    }
});

router.post("/send-all", async (req, res) => {
    try {
        const { titulo, mensagem, tipo, url } = req.body;

        if (!titulo || !mensagem) {
            return res.json({
                success: false,
                mensagem: "Informe título e mensagem."
            });
        }

        const resultado = await enviarParaTodos({
            titulo,
            mensagem,
            tipo: tipo || "geral",
            url: url || "/"
        });

        return res.json({
            success: true,
            mensagem: "Notificação geral enviada.",
            resultado
        });

    } catch (err) {
        console.error("Erro ao enviar push geral:", err.message);

        return res.status(500).json({
            success: false,
            mensagem: err.message
        });
    }
});

router.post("/send-whatsapp", async (req, res) => {
    try {
        const {
            whatsapp,
            titulo,
            mensagem,
            tipo,
            url
        } = req.body;

        if (!whatsapp || !titulo || !mensagem) {
            return res.json({
                success: false,
                mensagem: "Informe WhatsApp, título e mensagem."
            });
        }

        const resultado = await enviarParaWhatsapp({
            whatsapp,
            titulo,
            mensagem,
            tipo: tipo || "individual",
            url: url || "/"
        });

        return res.json({
            success: true,
            mensagem: "Notificação individual enviada.",
            resultado
        });

    } catch (err) {
        console.error("Erro ao enviar push individual:", err.message);

        return res.status(500).json({
            success: false,
            mensagem: err.message
        });
    }
});

router.get("/notificacoes", async (req, res) => {
    try {
        const whatsapp = req.query.whatsapp;

        if (!whatsapp) {
            return res.json({
                success: false,
                mensagem: "WhatsApp obrigatório."
            });
        }

        const notificacoes = await listarNotificacoesCliente(whatsapp);

        return res.json({
            success: true,
            total: notificacoes.length,
            notificacoes
        });

    } catch (err) {
        console.error("Erro ao listar notificações:", err.message);

        return res.status(500).json({
            success: false,
            mensagem: err.message
        });
    }
});

module.exports = router;
