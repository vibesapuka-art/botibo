const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

const { buscarDnsValidadasParaIb } = require("../services/dns_service");

function atualizarPedido(pedido, dados = {}) {
    Object.assign(pedido, dados);
    pedido.atualizadoEm = new Date();
}

module.exports = async (pedidos, config = {}) => {
    if (!pedidos || !Array.isArray(pedidos)) return null;

    const pedido = pedidos.find(p => p.status === "processando");
    if (!pedido) return null;

    let browser;

    try {
        atualizarPedido(pedido, {
            titulo: "Buscando DNS ativas",
            mensagem: "Buscando DNS ativas no MongoDB e revalidando antes de enviar ao IB...",
            progresso: Math.max(pedido.progresso || 0, 45),
            checklist: {
                ...(pedido.checklist || {}),
                dns: false
            }
        });

        const dnsSorteados = await buscarDnsValidadasParaIb(
            pedido.user,
            pedido.pass,
            5
        );

        if (!dnsSorteados || dnsSorteados.length === 0) {
            throw new Error("Nenhuma DNS ativa foi aprovada na revalidação antes do IB.");
        }

        console.log("✅ DNS aprovadas para IB:", dnsSorteados);

        atualizarPedido(pedido, {
            titulo: "DNS aprovadas",
            mensagem: `${dnsSorteados.length} DNS aprovadas. Acessando painel para adicionar playlists...`,
            progresso: 50,
            totalPlaylists: dnsSorteados.length,
            checklist: {
                ...(pedido.checklist || {}),
                dns: true
            }
        });

        browser = await puppeteer.launch({
            args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox"],
            executablePath: await chromium.executablePath(),
            headless: true,
        });

        const page = await browser.newPage();

        await page.setViewport({
            width: 1280,
            height: 800
        });

        await page.setUserAgent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        );

        atualizarPedido(pedido, {
            titulo: "Acessando IB Player",
            mensagem: "Entrando no painel para adicionar as novas playlists...",
            progresso: 55,
            checklist: {
                ...(pedido.checklist || {}),
                acessoAdicionar: false
            }
        });

        await page.goto("https://iboproapp.com/manage-playlists/login/", {
            waitUntil: "domcontentloaded",
            timeout: 60000
        });

        await page.waitForSelector("#mac_address", {
            timeout: 30000
        });

        await page.type("#mac_address", pedido.mac, {
            delay: 50
        });

        await page.type("#password", (pedido.key || pedido.device_id), {
            delay: 50
        });

        await page.keyboard.press("Enter");

        await page.waitForSelector("button.btn-secondary", {
            timeout: 45000
        });

        atualizarPedido(pedido, {
            titulo: "Adicionando playlists",
            mensagem: "Painel acessado. Iniciando gravação das novas playlists...",
            progresso: 60,
            checklist: {
                ...(pedido.checklist || {}),
                acessoAdicionar: true
            }
        });

        for (let i = 0; i < dnsSorteados.length; i++) {
            const nomeLista = `IMPTV${i + 1}`;
            const numeroPlaylist = i + 1;

            const checklistAtual = {
                ...(pedido.checklist || {})
            };

            atualizarPedido(pedido, {
                titulo: `Gravando playlist ${numeroPlaylist}`,
                mensagem: `Gravando ${nomeLista}. Mantenha a TV desligada.`,
                progresso: Math.min(95, 60 + (numeroPlaylist - 1) * 7),
                playlistAtual: numeroPlaylist,
                totalPlaylists: dnsSorteados.length,
                checklist: checklistAtual
            });

            const jaExiste = await page.evaluate((nome) => {
                const celulas = Array.from(document.querySelectorAll("td"));
                return celulas.some(td => td.innerText.trim() === nome);
            }, nomeLista);

            if (jaExiste) {
                console.log(`⚠️ ${nomeLista} já existe. Pulando...`);
                checklistAtual[`playlist${numeroPlaylist}`] = true;
                atualizarPedido(pedido, {
                    mensagem: `${nomeLista} já existia. Pulando para próxima...`,
                    progresso: Math.min(95, 60 + numeroPlaylist * 7),
                    checklist: checklistAtual
                });
                continue;
            }

            const baseDns = dnsSorteados[i];

            const urlFinal = `${baseDns}/get.php?username=${pedido.user}&password=${pedido.pass}&type=m3u_plus&output=mpegts`;

            await page.evaluate(() => {
                const btnAdd = Array.from(document.querySelectorAll("button"))
                    .find(b => b.innerText.includes("Add Playlist"));

                if (btnAdd) btnAdd.click();
            });

            await page.waitForSelector('input[name="name"]', {
                timeout: 15000
            });

            await page.type('input[name="name"]', nomeLista, {
                delay: 50
            });

            await page.type('input[name="url"]', urlFinal, {
                delay: 50
            });

            await page.click("#playlist-protected");

            await new Promise(r => setTimeout(r, 800));

            await page.type('input[name="pin"]', "123321", {
                delay: 50
            });

            await page.type('input[name="cpin"]', "123321", {
                delay: 50
            });

            await page.keyboard.press("Enter");

            await new Promise(r => setTimeout(r, 7000));

            checklistAtual[`playlist${numeroPlaylist}`] = true;

            atualizarPedido(pedido, {
                titulo: `Playlist ${numeroPlaylist} adicionada`,
                mensagem: `${nomeLista} adicionada com sucesso.`,
                progresso: Math.min(95, 60 + numeroPlaylist * 7),
                checklist: checklistAtual
            });

            await page.reload({
                waitUntil: "domcontentloaded"
            });

            await page.waitForSelector("button.btn-secondary", {
                timeout: 20000
            });
        }

        atualizarPedido(pedido, {
            titulo: "Tudo pronto!",
            mensagem: "✅ Playlists atualizadas com sucesso. Pode ligar a TV.",
            progresso: 100,
            status: "ok",
            checklist: {
                ...(pedido.checklist || {}),
                finalizado: true
            }
        });

        if (config.manterAberto) {
            return {
                browser,
                page
            };
        }

        await browser.close();
        return null;

    } catch (err) {
        if (browser) {
            try {
                const pages = await browser.pages();

                if (pages[0]) {
                    await pages[0].screenshot({
                        path: "public/erro_final.png",
                        fullPage: true
                    });
                }

                await browser.close();

            } catch (closeError) {
                console.error("Erro ao fechar browser:", closeError.message);
            }
        }

        atualizarPedido(pedido, {
            titulo: "Erro na atualização",
            mensagem: "❌ Erro ao adicionar playlists: " + err.message,
            progresso: 100,
            status: "erro"
        });

        throw err;
    }
};
