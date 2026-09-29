// Camada de acesso a dados — só SQL, sem regra de negócio.
const db = require('../db/pool');

const CAMPOS_PUBLICOS = 'id,nome,sobrenome,cpf,email,telefone,especialidade,tipo,ativo,criado_em';

module.exports = {
    async listar({ pagina = 1, limite = 12 } = {}) {
        const totalResp = await db.query('SELECT COUNT(*)::int AS total FROM usuarios');
        const offset = (Math.max(1, pagina) - 1) * limite;
        const { rows } = await db.query(
            `SELECT ${CAMPOS_PUBLICOS} FROM usuarios ORDER BY id LIMIT $1 OFFSET $2`,
            [limite, offset]
        );
        return { dados: rows, total: totalResp.rows[0].total };
    },

    async buscarPorId(id) {
        const { rows } = await db.query(`SELECT ${CAMPOS_PUBLICOS} FROM usuarios WHERE id=$1`, [id]);
        return rows[0] || null;
    },

    async atualizar(id, dados) {
        const atual = await this.buscarPorId(id);
        if (!atual) return false;
        const { nome, sobrenome, telefone, especialidade } = { ...atual, ...dados };
        const { rowCount } = await db.query(
            'UPDATE usuarios SET nome=$1,sobrenome=$2,telefone=$3,especialidade=$4 WHERE id=$5',
            [nome, sobrenome, telefone || null, especialidade, id]
        );
        return rowCount > 0;
    },

    async remover(id) {
        const { rowCount } = await db.query('DELETE FROM usuarios WHERE id=$1', [id]);
        return rowCount > 0;
    },

    // Liga (ou cria) a linha de `usuarios` correspondente a um usuário autenticado
    // via Supabase Auth — é o que permite ao backend saber o `tipo` (admin/adotante)
    // real de quem está chamando, em vez de confiar cegamente no token.
    //
    // ADMIN_EMAILS (env, separados por vírgula) promove automaticamente a
    // admin quem logar com um desses emails — sem isso, ninguém consegue
    // virar admin sem alguém rodar UPDATE manual no banco.
    async buscarOuCriarPorAuthId(authId, email, metadata = {}) {
        const adminEmails  = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
        const deveSerAdmin = adminEmails.includes((email || '').toLowerCase());

        const existente = await db.query('SELECT * FROM usuarios WHERE auth_id=$1', [authId]);
        if (existente.rows.length) {
            const usuario = existente.rows[0];
            if (deveSerAdmin && usuario.tipo !== 'admin') {
                const { rows } = await db.query('UPDATE usuarios SET tipo=$1 WHERE id=$2 RETURNING *', ['admin', usuario.id]);
                return rows[0];
            }
            return usuario;
        }

        const porEmail = await db.query('SELECT * FROM usuarios WHERE email=$1', [email]);
        if (porEmail.rows.length) {
            const tipoFinal = deveSerAdmin ? 'admin' : porEmail.rows[0].tipo;
            const { rows } = await db.query(
                'UPDATE usuarios SET auth_id=$1, tipo=$2 WHERE id=$3 RETURNING *',
                [authId, tipoFinal, porEmail.rows[0].id]
            );
            return rows[0];
        }

        const { rows } = await db.query(
            `INSERT INTO usuarios (auth_id, nome, sobrenome, email, especialidade, tipo)
             VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
            [authId, metadata.nome || 'Usuário', metadata.sobrenome || '', email,
             metadata.especialidade || 'Visitante', deveSerAdmin ? 'admin' : 'adotante']
        );
        return rows[0];
    },
};
