// Camada de negócio — regras do fluxo de adoção.
const repo       = require('../repositories/adocoesRepository');
const animaisRepo = require('../repositories/animaisRepository');

function gerarProtocolo() {
    return `GP-A${Date.now().toString().slice(-6)}`;
}

module.exports = {
    async solicitar({ idAnimal, idUsuario, nomeAdotante, telefone, residencia, motivacao }) {
        if (!nomeAdotante || !nomeAdotante.trim()) throw new Error('Nome é obrigatório');

        const animal = await animaisRepo.buscarPorId(idAnimal);
        if (!animal) throw new Error('Animal não encontrado');
        if (animal.status !== 'disponivel') {
            throw new Error(
                animal.status === 'adotado'
                    ? 'Este animal já foi adotado'
                    : 'Este animal já tem uma solicitação de adoção em análise'
            );
        }

        const protocolo = gerarProtocolo();
        const adocao = await repo.criar({ protocolo, idAnimal, idUsuario, nomeAdotante, telefone, residencia, motivacao });

        // Enquanto a solicitação está pendente, o animal sai da vitrine de "disponível"
        await animaisRepo.atualizar(idAnimal, { ...animal, status: 'em_processo' });

        return adocao;
    },

    listarPara(usuario) {
        return usuario.tipo === 'admin' ? repo.listarTodas() : repo.listarPorUsuario(usuario.id);
    },

    async atualizarStatus(id, novoStatus) {
        if (!['pendente', 'aprovada', 'recusada'].includes(novoStatus)) {
            throw new Error('Status inválido');
        }
        // O trigger fn_adocao_aprovada (database.sql) cuida de refletir a
        // decisão no animal — aprovar marca "adotado", recusar volta a
        // "disponivel". Uma única fonte de verdade pras duas pontas.
        return repo.atualizarStatus(id, novoStatus);
    },
};
