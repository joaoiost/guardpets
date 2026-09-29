// Camada de acesso a dados — só SQL, sem regra de negócio.
const db = require('../db/pool');

module.exports = {
    async criar({ nome, telefone, tipo, cidade, mensagem }) {
        const { rows } = await db.query(
            `INSERT INTO voluntarios (nome, telefone, tipo, cidade, mensagem)
             VALUES ($1,$2,$3,$4,$5) RETURNING *`,
            [nome, telefone, tipo || 'Outro', cidade || null, mensagem || null]
        );
        return rows[0];
    },

    async listar() {
        const { rows } = await db.query('SELECT * FROM voluntarios ORDER BY criado_em DESC');
        return rows;
    },
};
