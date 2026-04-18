let pedidos = [];

module.exports = {
    adicionarPedido: (dados) => {
        // Usa o DNS padrão configurado
        const dnsPadrao = "http://seu-dns-aqui.com:8080"; 
        const linkM3U = `${dnsPadrao}/get.php?username=${dados.user}&password=${dados.pass}&type=m3u_plus&output=ts`;

        // Remove duplicados para o mesmo MAC
        pedidos = pedidos.filter(p => p.mac !== dados.mac);
        
        const novoPedido = {
            ...dados,
            m3u: linkM3U,
            status: "pendente",
            concluidos: 0,
            total: 1
        };
        
        pedidos.push(novoPedido);
        return novoPedido;
    },

    buscarPedido: (mac) => pedidos.find(p => p.mac === mac),

    getFilaCompleta: () => pedidos
};
