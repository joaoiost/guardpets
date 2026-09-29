// Helpers de paginação — usados por toda rota de listagem da API.
function parsePaginacao(query, limitePadrao = 12) {
    const pagina = Math.max(1, parseInt(query.pagina, 10) || 1);
    const limite = Math.min(100, Math.max(1, parseInt(query.limite, 10) || limitePadrao));
    return { pagina, limite };
}

function montarResposta(dados, total, pagina, limite) {
    return {
        dados,
        paginacao: {
            pagina,
            limite,
            total,
            totalPaginas: Math.max(1, Math.ceil(total / limite)),
        },
    };
}

module.exports = { parsePaginacao, montarResposta };
