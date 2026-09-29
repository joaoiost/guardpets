// Camada de acesso a dados — só SQL, sem regra de negócio.
const db = require('../db/pool');

module.exports = {
    async listar({ especie, porte, idade, localizacao } = {}) {
        const condicoes = [];
        const valores = [];
        if (especie)     { valores.push(especie);          condicoes.push(`especie ILIKE $${valores.length}`); }
        if (porte)       { valores.push(porte);             condicoes.push(`porte = $${valores.length}`); }
        if (idade)       { valores.push(idade);              condicoes.push(`idade = $${valores.length}`); }
        if (localizacao) { valores.push(`%${localizacao}%`); condicoes.push(`localizacao ILIKE $${valores.length}`); }

        const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';
        const { rows } = await db.query(`SELECT * FROM animais ${where} ORDER BY created_at DESC`, valores);
        return rows;
    },

    async buscarPorId(id) {
        const { rows } = await db.query('SELECT * FROM animais WHERE id=$1', [id]);
        return rows[0] || null;
    },

    async criar(a) {
        const { rows } = await db.query(
            `INSERT INTO animais (nome, especie, raca, porte, idade, situacao, saude, castrado, vacinado, descricao, localizacao, foto_url, status)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
            [a.nome, a.especie, a.raca || 'SRD', a.porte || 'Médio', a.idade || 'Não informado',
             a.situacao || 'Resgatado', a.saude || null, !!a.castrado, !!a.vacinado,
             a.descricao || null, a.localizacao || null, a.foto_url || null, a.status || 'disponivel']
        );
        return rows[0];
    },

    async atualizar(id, a) {
        const { rows } = await db.query(
            `UPDATE animais SET nome=$1, especie=$2, raca=$3, porte=$4, idade=$5, situacao=$6, saude=$7,
                                 castrado=$8, vacinado=$9, descricao=$10, localizacao=$11, foto_url=$12, status=$13
             WHERE id=$14 RETURNING *`,
            [a.nome, a.especie, a.raca, a.porte, a.idade, a.situacao, a.saude,
             !!a.castrado, !!a.vacinado, a.descricao, a.localizacao, a.foto_url, a.status, id]
        );
        return rows[0] || null;
    },

    async remover(id) {
        const { rowCount } = await db.query('DELETE FROM animais WHERE id=$1', [id]);
        return rowCount > 0;
    },
};
