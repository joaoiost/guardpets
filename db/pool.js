// [SINGLETON] Única instância do cliente de banco (Postgres/Supabase) da aplicação.
// Toda leitura/escrita passa por aqui — nenhum outro arquivo deve criar `new Pool()`.
const { Pool } = require('pg');

const pool = new Pool(
    process.env.DATABASE_URL
        ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
        : {}
);

module.exports = pool;
