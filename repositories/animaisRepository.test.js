// Testa a MONTAGEM das queries (filtros dinâmicos, paginação) mockando
// db.query — não bate no banco real, então roda em qualquer máquina/CI.
const { test, mock, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const db = require('../db/pool');
const animaisRepo = require('./animaisRepository');

beforeEach(() => mock.restoreAll());

function mockDb({ total = 0, linhas = [] } = {}) {
    let chamada = 0;
    return mock.method(db, 'query', async () => {
        chamada += 1;
        // 1ª chamada de listar() é o COUNT, a 2ª é o SELECT paginado
        return chamada === 1 ? { rows: [{ total }] } : { rows: linhas };
    });
}

test('listar() sem filtros não adiciona cláusula WHERE', async () => {
    const queryMock = mockDb({ total: 2, linhas: [{ id: 1 }, { id: 2 }] });
    const { dados, total } = await animaisRepo.listar({});

    const [sqlCount] = queryMock.mock.calls[0].arguments;
    assert.ok(!sqlCount.includes('WHERE'));
    assert.strictEqual(total, 2);
    assert.strictEqual(dados.length, 2);
});

test('listar() com filtro de espécie gera WHERE com ILIKE parametrizado', async () => {
    const queryMock = mockDb({ total: 1, linhas: [{ id: 3, especie: 'Gato' }] });
    await animaisRepo.listar({ especie: 'Gato' });

    const [sqlCount, valoresCount] = queryMock.mock.calls[0].arguments;
    assert.ok(sqlCount.includes('WHERE'));
    assert.ok(sqlCount.includes('especie ILIKE $1'));
    assert.deepStrictEqual(valoresCount, ['Gato']);
});

test('listar() combina múltiplos filtros com AND', async () => {
    const queryMock = mockDb({ total: 0, linhas: [] });
    await animaisRepo.listar({ especie: 'Cachorro', porte: 'Grande' });

    const [sqlCount, valoresCount] = queryMock.mock.calls[0].arguments;
    assert.ok(sqlCount.includes('especie ILIKE $1 AND porte = $2'));
    assert.deepStrictEqual(valoresCount, ['Cachorro', 'Grande']);
});

test('listar() aplica LIMIT/OFFSET calculado a partir de pagina/limite', async () => {
    const queryMock = mockDb({ total: 30, linhas: [] });
    await animaisRepo.listar({ pagina: 3, limite: 10 });

    const [sqlSelect, valoresSelect] = queryMock.mock.calls[1].arguments;
    assert.ok(sqlSelect.includes('LIMIT'));
    assert.ok(sqlSelect.includes('OFFSET'));
    // página 3, 10 por página -> pula os 20 primeiros
    assert.deepStrictEqual(valoresSelect, [10, 20]);
});
