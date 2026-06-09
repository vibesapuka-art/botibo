const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

function atualizarPedido(pedido, dados = {}) {
    Object.assign(pedido, dados);
    pedido.atualizadoEm = new Date();
}

module.exports = async (pedido) => {
    let browser;

    try {
        atualizarPedido(pedido, {
            titulo: "Acessando IB Player",
            mensagem: "Conectando ao painel para limpar playlists antigas...",
            progresso: Math.max(pedido.progresso || 0, 15),
            checklist: {
                ...(pedido.checklist || {}),
                acesso: false,
                limpeza: false
            }
        });

        browser = await puppeteer.launch({
            args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox"],
            executablePath: await chromium.executablePath(),
            headless: true
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });
        await page.setUserAgent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        );

        // 1. LOGIN
        atualizarPedido(pedido, {
            titulo: "Acessando IB Player",
            mensagem: "Entrando no painel do IB Player...",
            progresso: Math.max(pedido.progresso || 0, 20),
            checklist: {
                ...(pedido.checklist || {}),
                acesso: false
            }
        });

        await page.goto("https://iboproapp.com/manage-playlists/login/", {
            waitUntil: "networkidle2",
            timeout: 60000
        });

        await page.waitForSelector('#mac_address', { timeout: 30000 });
        await page.type('#mac_address', pedido.mac, { delay: 50 });
        await page.type('#password', pedido.key || pedido.device_id, { delay: 50 });

        await Promise.all([
            page.click('button[type="submit"]'),
            page.waitForNavigation({ waitUntil: "networkidle2", timeout: 60000 })
        ]);

        atualizarPedido(pedido, {
            titulo: "IB Player acessado",
            mensagem: "MAC e KEY validados. Procurando playlists antigas...",
            progresso: Math.max(pedido.progresso || 0, 28),
            checklist: {
                ...(pedido.checklist || {}),
                acesso: true,
                validacao: true
            }
        });

        // 2. LOOP DE LIMPEZA
        let contadorLimpeza = 0;

        while (true) {
            await page.reload({ waitUntil: "networkidle2", timeout: 60000 });

            const totalListas = await page.$$eval('button.btn-warning', btns => btns.length);

            if (totalListas === 0) {
                atualizarPedido(pedido, {
                    titulo: "Playlists antigas removidas",
                    mensagem: "Tudo limpo. Agora vamos adicionar as novas playlists.",
                    progresso: Math.max(pedido.progresso || 0, 40),
                    checklist: {
                        ...(pedido.checklist || {}),
                        limpeza: true
                    }
                });
                break;
            }

            contadorLimpeza++;

            atualizarPedido(pedido, {
                titulo: "Limpando playlists antigas",
                mensagem: `Encontradas ${totalListas} playlists antigas. Excluindo...`,
                progresso: Math.min(40, 28 + contadorLimpeza * 3),
                checklist: {
                    ...(pedido.checklist || {}),
                    limpeza: false
                }
            });

            await page.evaluate(() => {
                const btn = document.querySelector('button.btn-warning');
                if (btn) btn.click();
            });

            try {
                await page.waitForSelector('input[name="pin"]', {
                    visible: true,
                    timeout: 10000
                });

                const inputPin = await page.$('input[name="pin"]');
                await inputPin.click({ clickCount: 3 });
                await page.keyboard.press('Backspace');
                await page.keyboard.type("123321", { delay: 120 });

                await page.keyboard.press('Enter');

                await page.evaluate(() => {
                    const okBtn = document.querySelector('button.btn-success');
                    if (okBtn) okBtn.click();
                });

                await new Promise(r => setTimeout(r, 6000));

            } catch (pinErr) {
                console.log("Erro ao preencher PIN ou modal não apareceu:", pinErr.message);
                atualizarPedido(pedido, {
                    titulo: "Falha na limpeza",
                    mensagem: "Não foi possível confirmar a exclusão de uma playlist.",
                    progresso: 100
                });
                throw pinErr;
            }
        }

    } catch (err) {
        console.error("Erro no Cleaner:", err.message);
        atualizarPedido(pedido, {
            titulo: "Erro ao limpar playlists",
            mensagem: "❌ Erro ao limpar playlists: " + err.message,
            progresso: 100
        });
        throw err;

    } finally {
        if (browser) {
            try {
                await browser.close();
            } catch (e) {
                console.error("Erro ao fechar browser do cleaner:", e.message);
            }
        }
    }
};
