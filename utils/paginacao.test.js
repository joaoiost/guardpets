const { test } = require('node:test');
const assert = require('node:assert/strict');

const { parsePaginacao, montarResposta } = require('./paginacao');

test('parsePaginacao() usa valores padrão quando a query vem vazia', () => {
    const { pagina, limite } = parsePaginacao({});
    assert.strictEqual(pagina, 1);
    assert.strictEqual(limite, 12);
});

test('parsePaginacao() respeita pagina e limite informados', () => {
    const { pagina, limite } = parsePaginacao({ pagina: '3', limite: '20' });
    assert.strictEqual(pagina, 3);
    assert.strictEqual(limite, 20);
});

test('parsePaginacao() nunca deixa a página ser menor que 1', () => {
    const { pagina } = parsePaginacao({ pagina: '-5' });
    assert.strictEqual(pagina, 1);
});

test('parsePaginacao() ignora valor não numérico e cai no padrão', () => {
    const { pagina, limite } = parsePaginacao({ pagina: 'abc', limite: 'xyz' });
    assert.strictEqual(pagina, 1);
    assert.strictEqual(limite, 12);
});

test('parsePaginacao() limita o máximo de itens por página em 100 (evita ?limite=999999)', () => {
    const { limite } = parsePaginacao({ limite: '99999' });
    assert.strictEqual(limite, 100);
});

test('montarResposta() calcula o total de páginas corretamente', () => {
    const resp = montarResposta([1, 2, 3], 16, 1, 5);
    assert.deepStrictEqual(resp.paginacao, { pagina: 1, limite: 5, total: 16, totalPaginas: 4 });
});

test('montarResposta() nunca retorna 0 páginas, mesmo com total 0', () => {
    const resp = montarResposta([], 0, 1, 12);
    assert.strictEqual(resp.paginacao.totalPaginas, 1);
});
