const express = require('express');
const path    = require('path');
const { Pool } = require('pg');
const cors    = require('cors');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');

const app        = express();
const PORT       = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'guardpets_secret_dev_only';

if (!process.env.JWT_SECRET) {
    console.warn('[AVISO] JWT_SECRET não definido — usando chave temporária. Configure no ambiente de produção.');
}

// Permite mesma origem e domínios .vercel.app por padrão
const corsOriginExtra = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : [];
app.use(cors({
    origin: (origin, cb) => {
        if (!origin) return cb(null, true); // chamadas server-side / curl
        if (/\.vercel\.app$/.test(origin)) return cb(null, true);
        if (origin === 'http://localhost:3000') return cb(null, true);
        if (corsOriginExtra.includes(origin)) return cb(null, true);
        cb(new Error('CORS: origem não permitida'));
    },
    credentials: true,
}));
app.use(express.json());

// Banco de dados (Supabase)
const db = new Pool(
    process.env.DATABASE_URL
        ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
        : {}
);

function checarBanco(res) {
    if (!process.env.DATABASE_URL) {
        res.status(503).json({ error: 'Banco de dados não configurado. Adicione DATABASE_URL nas variáveis de ambiente.' });
        return false;
    }
    return true;
}

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

    if (!JWT_SECRET) return res.status(500).json({ error: 'Servidor não configurado' });
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
    if (!checarBanco(res)) return;
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
    if (!checarBanco(res)) return;
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

        if (!JWT_SECRET) return res.status(500).json({ error: 'Servidor não configurado' });
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
    const alvo = parseInt(req.params.id, 10);
    if (req.usuario.id !== alvo && req.usuario.tipo !== 'admin')
        return res.status(403).json({ error: 'Sem permissão para remover este usuário' });
    try {
        const r = await db.query('DELETE FROM usuarios WHERE id=$1', [alvo]);
        if (!r.rowCount) return res.status(404).json({ error: 'Usuário não encontrado' });
        res.json({ message: 'Usuário removido!' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================================
// OCORRÊNCIAS
// ============================================================

app.post('/denuncia', async (req, res) => {
    if (!checarBanco(res)) return;
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
    if (!checarBanco(res)) return;
    try {
        const r = await db.query('SELECT * FROM ocorrencias ORDER BY criado_em DESC');
        res.json(r.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/ocorrencias/:id/status', autenticar, async (req, res) => {
    if (!checarBanco(res)) return;
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

// Rotas limpas para cada página (sem extensão .html)
const pages = ['adocao', 'denuncia', 'voluntariado', 'sobre', 'doacao'];
pages.forEach(p => {
    app.get(`/${p}`, (_req, res) => res.sendFile(path.join(__dirname, `${p}.html`)));
});

app.get('*', (_req, res) =>
    res.sendFile(path.join(__dirname, 'index.html'))
);

module.exports = app;
if (!process.env.VERCEL) {
    app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
}
