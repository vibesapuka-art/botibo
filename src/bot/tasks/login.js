/**
 * Realiza o login no painel do IBO Player
 */
module.exports = async (page, mac, key) => {
    await page.goto("https://iboplayer.pro/manage-playlists/login/", { waitUntil: "networkidle2" });
    await page.type("input[name='mac_address']", mac);
    await page.type("input[name='password']", key);
    
    await page.evaluate(() => {
        const btn = document.querySelector("button[type='submit']");
        if (btn) { 
            btn.disabled = false; 
            btn.click(); 
        }
    });
    
    // Tempo de espera para o redirecionamento pós-login
    await new Promise(r => setTimeout(r, 8000));
};
