const { test, mock, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const repo = require('../repositories/animaisRepository');
const animaisService = require('./animaisService');

beforeEach(() => mock.restoreAll());

test('criar() rejeita animal sem nome', async () => {
    await assert.rejects(
        () => animaisService.criar({ especie: 'Cachorro' }),
        /Nome e espécie são obrigatórios/
    );
});

test('criar() rejeita animal sem espécie', async () => {
    await assert.rejects(
        () => animaisService.criar({ nome: 'Rex' }),
        /Nome e espécie são obrigatórios/
    );
});

test('criar() delega pro repository quando os dados são válidos', async () => {
    const criarMock = mock.method(repo, 'criar', async (dados) => ({ id: 1, ...dados }));
    const resultado = await animaisService.criar({ nome: 'Rex', especie: 'Cachorro' });

    assert.strictEqual(criarMock.mock.callCount(), 1);
    assert.strictEqual(resultado.nome, 'Rex');
});

test('atualizar() retorna null quando o animal não existe', async () => {
    mock.method(repo, 'buscarPorId', async () => null);
    const resultado = await animaisService.atualizar(999, { nome: 'Novo Nome' });
    assert.strictEqual(resultado, null);
});

test('atualizar() mescla os dados existentes com os novos (não perde campo omitido)', async () => {
    mock.method(repo, 'buscarPorId', async () => ({
        id: 1, nome: 'Rex', especie: 'Cachorro', porte: 'Grande', status: 'disponivel',
    }));
    const atualizarMock = mock.method(repo, 'atualizar', async (id, dados) => ({ id, ...dados }));

    await animaisService.atualizar(1, { nome: 'Rex Atualizado' });

    const [, dadosEnviados] = atualizarMock.mock.calls[0].arguments;
    assert.strictEqual(dadosEnviados.nome, 'Rex Atualizado');   // campo novo aplicado
    assert.strictEqual(dadosEnviados.porte, 'Grande');          // campo omitido preservado
    assert.strictEqual(dadosEnviados.status, 'disponivel');     // campo omitido preservado
});
