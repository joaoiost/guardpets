const express = require('express');
const path    = require('path');
const { Pool } = require('pg');
const cors    = require('cors');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');

const app        = express();
const PORT       = process.env.PORT       || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'guardpets_secret_key_mude_em_producao';

app.use(cors());
app.use(express.json());

// Banco de dados (Supabase)
const db = new Pool({
    connectionString: process.env.DATABASE_URL || null,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

// ============================================================
// HEALTH CHECK — útil para verificar se a função está rodando
// ============================================================
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        db_configured: !!process.env.DATABASE_URL,
        env: process.env.VERCEL ? 'vercel' : 'local',
    });
});

// Middleware de autenticação JWT
function autenticar(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token não fornecido' });

    jwt.verify(token, JWT_SECRET, (err, payload) => {
        if (err) return res.status(403).json({ error: 'Token inválido ou expirado' });
        req.usuario = payload;
        next();
    });
}

// ============================================================
// AUTENTICAÇÃO
// ============================================================

app.post('/register', async (req, res) => {
    const { nome, sobrenome, cpf, email, telefone, senha, especialidade } = req.body;
    if (!nome || !email || !senha)
        return res.status(400).json({ error: 'Nome, email e senha são obrigatórios' });

    try {
        const senhaHash = await bcrypt.hash(senha, 10);
        const result = await db.query(
            `INSERT INTO usuarios (nome, sobrenome, cpf, email, telefone, senha, especialidade)
             VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
            [nome, sobrenome || '', cpf || null, email, telefone || null, senhaHash, especialidade || 'Visitante']
        );
        res.status(201).json({ message: 'Usuário cadastrado!', id: result.rows[0].id });
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ error: 'Email já cadastrado' });
        res.status(500).json({ error: err.message });
    }
});

app.post('/login', async (req, res) => {
    const { email, senha } = req.body;
    if (!email || !senha)
        return res.status(400).json({ error: 'Email e senha são obrigatórios' });

    try {
        const result = await db.query(
            'SELECT * FROM usuarios WHERE email=$1 AND ativo=TRUE', [email]
        );
        if (result.rows.length === 0)
            return res.status(401).json({ error: 'Credenciais inválidas' });

        const usuario = result.rows[0];
        const ok = await bcrypt.compare(senha, usuario.senha);
        if (!ok) return res.status(401).json({ error: 'Credenciais inválidas' });

        const token = jwt.sign(
            { id: usuario.id, email: usuario.email, tipo: usuario.tipo },
            JWT_SECRET, { expiresIn: '8h' }
        );
        res.json({
            message: 'Login realizado!', token,
            usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, tipo: usuario.tipo },
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================================
// CRUD USUÁRIOS
// ============================================================

app.get('/usuarios', autenticar, async (req, res) => {
    try {
        const r = await db.query(
            'SELECT id,nome,sobrenome,cpf,email,telefone,especialidade,tipo,ativo,criado_em FROM usuarios'
        );
        res.json(r.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/usuarios/:id', autenticar, async (req, res) => {
    try {
        const r = await db.query(
            'SELECT id,nome,sobrenome,cpf,email,telefone,especialidade,tipo,ativo,criado_em FROM usuarios WHERE id=$1',
            [req.params.id]
        );
        if (!r.rows.length) return res.status(404).json({ error: 'Usuário não encontrado' });
        res.json(r.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/usuarios/:id', autenticar, async (req, res) => {
    const { nome, sobrenome, telefone, especialidade } = req.body;
    try {
        const r = await db.query(
            'UPDATE usuarios SET nome=$1,sobrenome=$2,telefone=$3,especialidade=$4 WHERE id=$5',
            [nome, sobrenome, telefone || null, especialidade, req.params.id]
        );
        if (!r.rowCount) return res.status(404).json({ error: 'Usuário não encontrado' });
        res.json({ message: 'Usuário atualizado!' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/usuarios/:id', autenticar, async (req, res) => {
    try {
        const r = await db.query('DELETE FROM usuarios WHERE id=$1', [req.params.id]);
        if (!r.rowCount) return res.status(404).json({ error: 'Usuário não encontrado' });
        res.json({ message: 'Usuário removido!' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================================
// OCORRÊNCIAS
// ============================================================

app.post('/denuncia', async (req, res) => {
    const { nome, localizacao, tipo, relato } = req.body;
    const protocolo = `GP-${Date.now().toString().slice(-6)}`;
    try {
        await db.query(
            'INSERT INTO ocorrencias (protocolo,nome_denunciante,localizacao,tipo,relato) VALUES ($1,$2,$3,$4,$5)',
            [protocolo, nome || 'Anônimo', localizacao, tipo, relato]
        );
        res.status(201).json({ message: 'Denúncia registrada!', protocolo });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/ocorrencias', autenticar, async (req, res) => {
    try {
        const r = await db.query('SELECT * FROM ocorrencias ORDER BY criado_em DESC');
        res.json(r.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/ocorrencias/:id/status', autenticar, async (req, res) => {
    try {
        const r = await db.query(
            'UPDATE ocorrencias SET status=$1 WHERE id=$2', [req.body.status, req.params.id]
        );
        if (!r.rowCount) return res.status(404).json({ error: 'Ocorrência não encontrada' });
        res.json({ message: 'Status atualizado!' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Arquivos estáticos (funciona local e no Vercel via includeFiles)
app.use(express.static(__dirname));
app.get('*', (_req, res) =>
    res.sendFile(path.join(__dirname, 'index.html'))
);

module.exports = app;
if (!process.env.VERCEL) {
    app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
}
