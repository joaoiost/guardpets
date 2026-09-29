// Camada de negócio — validações e regras sobre os dados de `animais`.
const repo = require('../repositories/animaisRepository');

module.exports = {
    listar: (filtros) => repo.listar(filtros),

    buscarPorId: (id) => repo.buscarPorId(id),

    async criar(dados) {
        if (!dados.nome || !dados.especie) {
            throw new Error('Nome e espécie são obrigatórios');
        }
        return repo.criar(dados);
    },

    async atualizar(id, dados) {
        const existente = await repo.buscarPorId(id);
        if (!existente) return null;
        return repo.atualizar(id, { ...existente, ...dados });
    },

    remover: (id) => repo.remover(id),
};
