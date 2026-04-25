const express = require('express');
const path = require('path');
const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

const engine = require('./src/bot/engine');
const gestorBot = require('./src/bot/gestor'); 
const cleaner = require('./src/bot/cleaner');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const statusPedidos = {};

app.post('/ativar', async (req, res) => {
    const dados = req.body;
    const macId = dados.mac.toLowerCase();
    
    statusPedidos[macId] = { 
        ...dados,
        user: dados.usuario, 
        pass: dados.senha,
        status: "processando", 
        mensagem: "⏳ Iniciando navegador único..." 
    };

    // FUNÇÃO QUE REAPROVEITA A MESMA JANELA
    const rodarFluxoUnificado = async (pedido) => {
        let browser;
        try {
            browser = await puppeteer.launch({
                args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox"],
                executablePath: await chromium.executablePath(),
                headless: true
            });

            const page = await browser.newPage();

            // PASSO 1: IBO PRO (ENGINE)
            pedido.mensagem = "📡 Passo 1/2: Configurando DNS...";
            // IMPORTANTE: O seu engine.js precisa aceitar receber a 'page' para não abrir outra
            await engine([pedido], page); 

            // PASSO 2: GESTOR (Na mesma aba, apenas navega por cima)
            if (pedido.tipo === 'ativar') {
                pedido.mensagem = "📝 Passo 2/2: Registrando no Gestor...";
                await gestorBot(pedido, page); 
            }

            pedido.status = "ok";
            pedido.mensagem = "✅ Sucesso! Tudo concluído na mesma janela.";

        } catch (err) {
            console.error("Erro no fluxo:", err.message);
            pedido.status = "erro";
            pedido.mensagem = "❌ Erro: " + err.message;
        } finally {
            if (browser) await browser.close(); // Só fecha aqui, depois de TUDO
        }
    };

    rodarFluxoUnificado(statusPedidos[macId]);
    res.json({ success: true });
});

// ... (resto das rotas status e limpar)
