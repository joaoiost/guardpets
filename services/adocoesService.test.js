const { test, mock, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const repo        = require('../repositories/adocoesRepository');
const animaisRepo  = require('../repositories/animaisRepository');
const adocoesService = require('./adocoesService');

beforeEach(() => mock.restoreAll());

test('solicitar() rejeita sem nome do adotante', async () => {
    await assert.rejects(
        () => adocoesService.solicitar({ idAnimal: 1, nomeAdotante: '' }),
        /Nome é obrigatório/
    );
});

test('solicitar() rejeita animal inexistente', async () => {
    mock.method(animaisRepo, 'buscarPorId', async () => null);
    await assert.rejects(
        () => adocoesService.solicitar({ idAnimal: 999, nomeAdotante: 'Maria' }),
        /Animal não encontrado/
    );
});

test('solicitar() rejeita animal já adotado', async () => {
    mock.method(animaisRepo, 'buscarPorId', async () => ({ id: 1, status: 'adotado' }));
    await assert.rejects(
        () => adocoesService.solicitar({ idAnimal: 1, nomeAdotante: 'Maria' }),
        /já foi adotado/
    );
});

test('solicitar() rejeita animal com solicitação em análise', async () => {
    mock.method(animaisRepo, 'buscarPorId', async () => ({ id: 1, status: 'em_processo' }));
    await assert.rejects(
        () => adocoesService.solicitar({ idAnimal: 1, nomeAdotante: 'Maria' }),
        /em análise/
    );
});

test('solicitar() cria a adoção e marca o animal como em_processo', async () => {
    mock.method(animaisRepo, 'buscarPorId', async () => ({ id: 1, status: 'disponivel', nome: 'Rex' }));
    const criarMock     = mock.method(repo, 'criar', async (dados) => ({ id: 10, ...dados }));
    const atualizarMock = mock.method(animaisRepo, 'atualizar', async (id, dados) => ({ id, ...dados }));

    const resultado = await adocoesService.solicitar({ idAnimal: 1, nomeAdotante: 'Maria', telefone: '11999999999' });

    assert.strictEqual(criarMock.mock.callCount(), 1);
    assert.strictEqual(resultado.nomeAdotante, 'Maria');

    const [idAtualizado, dadosAtualizados] = atualizarMock.mock.calls[0].arguments;
    assert.strictEqual(idAtualizado, 1);
    assert.strictEqual(dadosAtualizados.status, 'em_processo');
});

test('listarPara() busca todas as adoções quando o usuário é admin', async () => {
    const listarTodasMock = mock.method(repo, 'listarTodas', async () => ({ dados: [], total: 0 }));
    await adocoesService.listarPara({ id: 1, tipo: 'admin' }, { pagina: 1, limite: 10 });
    assert.strictEqual(listarTodasMock.mock.callCount(), 1);
});

test('listarPara() busca só as próprias adoções quando o usuário é adotante', async () => {
    const listarPorUsuarioMock = mock.method(repo, 'listarPorUsuario', async () => ({ dados: [], total: 0 }));
    await adocoesService.listarPara({ id: 42, tipo: 'adotante' }, { pagina: 1, limite: 10 });

    assert.strictEqual(listarPorUsuarioMock.mock.callCount(), 1);
    assert.strictEqual(listarPorUsuarioMock.mock.calls[0].arguments[0], 42);
});

test('atualizarStatus() rejeita status inválido', async () => {
    await assert.rejects(
        () => adocoesService.atualizarStatus(1, 'cancelada'),
        /Status inválido/
    );
});

test('atualizarStatus() aceita os três status válidos', async () => {
    const atualizarStatusMock = mock.method(repo, 'atualizarStatus', async (id, status) => ({ id, status }));
    for (const status of ['pendente', 'aprovada', 'recusada']) {
        await adocoesService.atualizarStatus(1, status);
    }
    assert.strictEqual(atualizarStatusMock.mock.callCount(), 3);
});
