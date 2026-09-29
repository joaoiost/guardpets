// Camada de acesso a dados — só SQL, sem regra de negócio.
const db = require('../db/pool');

module.exports = {
    async listarPorUsuario(idUsuario) {
        const { rows } = await db.query(
            `SELECT a.*, an.nome AS animal_nome, an.foto_url AS animal_foto
             FROM adocoes a LEFT JOIN animais an ON an.id = a.id_animal
             WHERE a.id_usuario=$1 ORDER BY a.data_solicitacao DESC`,
            [idUsuario]
        );
        return rows;
    },

    async listarTodas() {
        const { rows } = await db.query(
            `SELECT a.*, an.nome AS animal_nome, an.foto_url AS animal_foto,
                    u.nome AS usuario_nome, u.email AS usuario_email
             FROM adocoes a
             LEFT JOIN animais an  ON an.id = a.id_animal
             LEFT JOIN usuarios u  ON u.id  = a.id_usuario
             ORDER BY a.data_solicitacao DESC`
        );
        return rows;
    },

    async buscarPorId(id) {
        const { rows } = await db.query('SELECT * FROM adocoes WHERE id=$1', [id]);
        return rows[0] || null;
    },

    async criar({ protocolo, idAnimal, idUsuario, nomeAdotante, telefone, residencia, motivacao }) {
        const { rows } = await db.query(
            `INSERT INTO adocoes (protocolo, id_animal, id_usuario, nome_adotante, telefone, residencia, motivacao)
             VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
            [protocolo, idAnimal, idUsuario || null, nomeAdotante, telefone || null, residencia || null, motivacao || null]
        );
        return rows[0];
    },

    async atualizarStatus(id, status) {
        const { rows } = await db.query(
            'UPDATE adocoes SET status=$1 WHERE id=$2 RETURNING *',
            [status, id]
        );
        return rows[0] || null;
    },
};
