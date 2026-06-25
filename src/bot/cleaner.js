const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

function atualizarPedido(pedido, dados = {}) {
    Object.assign(pedido, dados);
    pedido.atualizadoEm = new Date();
}

async function esperar(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Cleaner inteligente:
 * - tenta apagar playlists com PIN 123321;
 * - se uma playlist não apagar, marca como ignorada;
 * - segue para as próximas;
 * - quando não conseguir apagar mais nenhuma, para a limpeza;
 * - NÃO trava em loop;
 * - permite o engine adicionar as playlists novas normalmente.
 */
module.exports = async (pedido) => {
    let browser;

    const playlistsIgnoradas = new Set();
    let tentativasSemSucesso = 0;
    const LIMITE_TENTATIVAS_SEM_SUCESSO = 3;

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

        await page.setViewport({
            width: 1280,
            height: 800
        });

        await page.setUserAgent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        );

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

        await page.waitForSelector("#mac_address", {
            timeout: 30000
        });

        await page.type("#mac_address", pedido.mac, {
            delay: 50
        });

        await page.type("#password", pedido.key || pedido.device_id, {
            delay: 50
        });

        await Promise.all([
            page.click('button[type="submit"]'),
            page.waitForNavigation({
                waitUntil: "networkidle2",
                timeout: 60000
            })
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

        let removidas = 0;

        while (true) {
            await page.reload({
                waitUntil: "networkidle2",
                timeout: 60000
            });

            await esperar(1500);

            const playlists = await page.evaluate(() => {
                const linhas = Array.from(document.querySelectorAll("tr"));

                return linhas.map((tr, index) => {
                    const texto = tr.innerText || "";
                    const temDelete = !!tr.querySelector("button.btn-warning");

                    let nome = "";

                    const celulas = Array.from(tr.querySelectorAll("td"));
                    if (celulas.length) {
                        nome = celulas.map(td => td.innerText.trim()).filter(Boolean)[0] || "";
                    }

                    return {
                        index,
                        nome: nome || texto.trim().slice(0, 80),
                        texto: texto.trim(),
                        temDelete
                    };
                }).filter(item => item.temDelete);
            });

            const playlistsDisponiveis = playlists.filter(item => {
                const chave = `${item.index}_${item.nome}`;
                return !playlistsIgnoradas.has(chave);
            });

            if (playlistsDisponiveis.length === 0) {
                const sobraram = playlists.length;

                atualizarPedido(pedido, {
                    titulo: "Limpeza concluída",
                    mensagem: sobraram > 0
                        ? `Algumas playlists não puderam ser apagadas por PIN diferente. Vamos continuar adicionando as novas.`
                        : "Tudo limpo. Agora vamos adicionar as novas playlists.",
                    progresso: Math.max(pedido.progresso || 0, 40),
                    playlistsIgnoradas: Array.from(playlistsIgnoradas),
                    checklist: {
                        ...(pedido.checklist || {}),
                        limpeza: true
                    }
                });

                console.log(`✅ Limpeza encerrada. Removidas: ${removidas}. Ignoradas: ${playlistsIgnoradas.size}. Sobraram: ${sobraram}.`);
                break;
            }

            if (tentativasSemSucesso >= LIMITE_TENTATIVAS_SEM_SUCESSO) {
                atualizarPedido(pedido, {
                    titulo: "Limpeza parcial concluída",
                    mensagem: "Não foi possível apagar algumas playlists. Vamos continuar adicionando as novas.",
                    progresso: Math.max(pedido.progresso || 0, 40),
                    playlistsIgnoradas: Array.from(playlistsIgnoradas),
                    checklist: {
                        ...(pedido.checklist || {}),
                        limpeza: true
                    }
                });

                console.log("⚠️ Limite de tentativas sem sucesso atingido. Continuando fluxo.");
                break;
            }

            const alvo = playlistsDisponiveis[0];
            const chaveAlvo = `${alvo.index}_${alvo.nome}`;

            atualizarPedido(pedido, {
                titulo: "Limpando playlists antigas",
                mensagem: `Tentando excluir: ${alvo.nome || "playlist antiga"}...`,
                progresso: Math.min(40, 28 + removidas * 3),
                checklist: {
                    ...(pedido.checklist || {}),
                    limpeza: false
                }
            });

            const totalAntes = playlists.length;

            const clicou = await page.evaluate((indexAlvo) => {
                const linhas = Array.from(document.querySelectorAll("tr"));
                const linha = linhas[indexAlvo];

                if (!linha) return false;

                const btn = linha.querySelector("button.btn-warning");
                if (!btn) return false;

                btn.click();
                return true;
            }, alvo.index);

            if (!clicou) {
                playlistsIgnoradas.add(chaveAlvo);
                tentativasSemSucesso++;
                console.log(`⚠️ Não consegui clicar no delete de: ${alvo.nome}`);
                continue;
            }

            let modalApareceu = false;

            try {
                await page.waitForSelector('input[name="pin"]', {
                    visible: true,
                    timeout: 7000
                });

                modalApareceu = true;

                const inputPin = await page.$('input[name="pin"]');
                await inputPin.click({ clickCount: 3 });
                await page.keyboard.press("Backspace");
                await page.keyboard.type("123321", {
                    delay: 120
                });

                await page.keyboard.press("Enter");

                await page.evaluate(() => {
                    const okBtn = document.querySelector("button.btn-success");
                    if (okBtn) okBtn.click();
                });

                await esperar(5000);

            } catch (pinErr) {
                console.log(`⚠️ PIN/modal falhou para ${alvo.nome}: ${pinErr.message}`);
            }

            await page.reload({
                waitUntil: "networkidle2",
                timeout: 60000
            });

            await esperar(1500);

            const totalDepois = await page.$$eval("button.btn-warning", btns => btns.length);

            if (totalDepois < totalAntes) {
                removidas++;
                tentativasSemSucesso = 0;

                atualizarPedido(pedido, {
                    titulo: "Playlist removida",
                    mensagem: `Playlist removida com sucesso. Removidas: ${removidas}.`,
                    progresso: Math.min(40, 30 + removidas * 3)
                });

                console.log(`✅ Playlist removida: ${alvo.nome}`);

            } else {
                playlistsIgnoradas.add(chaveAlvo);
                tentativasSemSucesso++;

                atualizarPedido(pedido, {
                    titulo: "Playlist ignorada",
                    mensagem: `Não foi possível apagar uma playlist. Provável PIN diferente. Continuando...`,
                    progresso: Math.min(40, 30 + removidas * 3)
                });

                console.log(`⚠️ Playlist ignorada por não apagar: ${alvo.nome}. Modal apareceu: ${modalApareceu}`);
            }
        }

    } catch (err) {
        console.error("Erro no Cleaner:", err.message);

        atualizarPedido(pedido, {
            titulo: "Limpeza parcial",
            mensagem: "⚠️ Não foi possível concluir toda a limpeza, mas vamos continuar adicionando as novas playlists.",
            progresso: Math.max(pedido.progresso || 0, 40),
            erroCleaner: err.message,
            checklist: {
                ...(pedido.checklist || {}),
                limpeza: true
            }
        });

        // Importante:
        // Não joga erro para fora.
        // Assim o index.js continua e chama o engine para adicionar as novas playlists.
        return;

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
