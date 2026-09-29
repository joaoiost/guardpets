const express = require('express');
const path    = require('path');
const cors    = require('cors');
const jwt     = require('jsonwebtoken');

const db              = require('./db/pool');           // [SINGLETON]
const usuariosRepo    = require('./repositories/usuariosRepository');
const voluntariosRepo = require('./repositories/voluntariosRepository');
const animaisService  = require('./services/animaisService');
const adocoesService  = require('./services/adocoesService');
const { parsePaginacao, montarResposta } = require('./utils/paginacao');

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
app.set('trust proxy', true); // necessário pra req.ip refletir o IP real atrás do proxy da Vercel

// Rate limit simples em memória pra evitar enchente de denúncia falsa.
// Limitação conhecida: em serverless (Vercel), cada instância fria tem sua
// própria memória — não é um limite 100% global, mas já barra flood básico.
const tentativasPorIp = new Map();
function limitarPorIp(maxTentativas, janelaMs) {
    return (req, res, next) => {
        const ip = req.ip || 'desconhecido';
        const agora = Date.now();
        const tentativas = (tentativasPorIp.get(ip) || []).filter(t => agora - t < janelaMs);
        if (tentativas.length >= maxTentativas) {
            return res.status(429).json({ error: 'Muitas tentativas. Aguarde um pouco e tente novamente.' });
        }
        tentativas.push(agora);
        tentativasPorIp.set(ip, tentativas);
        next();
    };
}

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

// Resolve um token (Supabase Auth ou JWT local) em req.usuario = { id, tipo, ... }
// real, vindo da tabela `usuarios` — nunca só o que o token diz. Retorna
// null se o token não existir ou for inválido (não decide o que fazer com isso,
// quem chama decide: `autenticar` bloqueia, `tentarAutenticar` segue em frente).
async function resolverUsuario(req) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return null;

    const supaUrl = process.env.SUPABASE_URL;
    const supaKey = process.env.SUPABASE_ANON_KEY;

    if (supaUrl && supaKey) {
        try {
            const resp = await fetch(`${supaUrl}/auth/v1/user`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'apikey': supaKey
                }
            });
            if (resp.ok) {
                const authUser = await resp.json();
                const usuario  = await usuariosRepo.buscarOuCriarPorAuthId(
                    authUser.id, authUser.email, authUser.user_metadata || {}
                );
                return { id: usuario.id, authId: authUser.id, email: usuario.email, tipo: usuario.tipo };
            }
        } catch (err) {
            // Não é "token inválido" — é o banco/rede que falhou. Loga pra não
            // virar um 401 misterioso quando o problema real é outro (ex.:
            // DATABASE_URL ausente ou banco fora do ar).
            console.error('[Auth] Falha ao resolver usuário via Supabase:', err.message);
        }
    }

    // Fallback: JWT local (compatibilidade durante transição)
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (_) {
        return null;
    }
}

// Exige login — usado nas rotas que só fazem sentido pra quem tem conta.
async function autenticar(req, res, next) {
    const usuario = await resolverUsuario(req);
    if (!usuario) return res.status(401).json({ error: 'Token não fornecido ou inválido' });
    req.usuario = usuario;
    next();
}

// Login opcional — usado em rotas públicas que ficam melhores quando a
// pessoa está logada (ex.: solicitar adoção guarda o vínculo com a conta
// dela), mas não podem exigir isso de quem só quer usar o site.
async function tentarAutenticar(req, res, next) {
    req.usuario = await resolverUsuario(req);
    next();
}

function exigirAdmin(req, res, next) {
    if (req.usuario?.tipo !== 'admin') return res.status(403).json({ error: 'Acesso restrito a administradores' });
    next();
}

// ============================================================
// AUTENTICAÇÃO
// ============================================================
// Login e cadastro são 100% via Supabase Auth (o front chama a API do
// Supabase direto). O backend só valida o token recebido — ver
// `resolverUsuario` acima. `/register` e `/login` locais foram removidos
// por não terem mais chamador nenhum.

// Retorna quem é o usuário autenticado (id interno + tipo real),
// já que o token por si só não diz se a conta é admin ou adotante.
app.get('/me', autenticar, (req, res) => res.json(req.usuario));

// ============================================================
// CRUD USUÁRIOS
// ============================================================

app.get('/usuarios', autenticar, async (req, res) => {
    try {
        const { pagina, limite } = parsePaginacao(req.query);
        const { dados, total } = await usuariosRepo.listar({ pagina, limite });
        res.json(montarResposta(dados, total, pagina, limite));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/usuarios/:id', autenticar, async (req, res) => {
    try {
        const usuario = await usuariosRepo.buscarPorId(req.params.id);
        if (!usuario) return res.status(404).json({ error: 'Usuário não encontrado' });
        res.json(usuario);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/usuarios/:id', autenticar, async (req, res) => {
    try {
        const ok = await usuariosRepo.atualizar(req.params.id, req.body);
        if (!ok) return res.status(404).json({ error: 'Usuário não encontrado' });
        res.json({ message: 'Usuário atualizado!' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/usuarios/:id', autenticar, async (req, res) => {
    const alvo = parseInt(req.params.id, 10);
    if (req.usuario.id !== alvo && req.usuario.tipo !== 'admin')
        return res.status(403).json({ error: 'Sem permissão para remover este usuário' });
    try {
        const ok = await usuariosRepo.remover(alvo);
        if (!ok) return res.status(404).json({ error: 'Usuário não encontrado' });
        res.json({ message: 'Usuário removido!' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================================
// CRUD ANIMAIS
// ============================================================

app.get('/animais', async (req, res) => {
    if (!checarBanco(res)) return;
    try {
        const { especie, porte, idade, localizacao } = req.query;
        const { pagina, limite } = parsePaginacao(req.query);
        const { dados, total } = await animaisService.listar({ especie, porte, idade, localizacao, pagina, limite });
        res.json(montarResposta(dados, total, pagina, limite));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/animais/:id', async (req, res) => {
    if (!checarBanco(res)) return;
    try {
        const animal = await animaisService.buscarPorId(req.params.id);
        if (!animal) return res.status(404).json({ error: 'Animal não encontrado' });
        res.json(animal);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/animais', autenticar, exigirAdmin, async (req, res) => {
    if (!checarBanco(res)) return;
    try {
        res.status(201).json(await animaisService.criar(req.body));
    } catch (err) { res.status(400).json({ error: err.message }); }
});

app.put('/animais/:id', autenticar, exigirAdmin, async (req, res) => {
    if (!checarBanco(res)) return;
    try {
        const animal = await animaisService.atualizar(req.params.id, req.body);
        if (!animal) return res.status(404).json({ error: 'Animal não encontrado' });
        res.json(animal);
    } catch (err) { res.status(400).json({ error: err.message }); }
});

app.delete('/animais/:id', autenticar, exigirAdmin, async (req, res) => {
    if (!checarBanco(res)) return;
    try {
        const ok = await animaisService.remover(req.params.id);
        if (!ok) return res.status(404).json({ error: 'Animal não encontrado' });
        res.json({ message: 'Animal removido!' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================================
// ADOÇÕES
// ============================================================

app.post('/adocoes', tentarAutenticar, async (req, res) => {
    if (!checarBanco(res)) return;
    const { idAnimal, nome, telefone, residencia, motivacao } = req.body;
    if (!idAnimal) return res.status(400).json({ error: 'idAnimal é obrigatório' });
    try {
        const adocao = await adocoesService.solicitar({
            idAnimal, idUsuario: req.usuario?.id || null, nomeAdotante: nome, telefone, residencia, motivacao,
        });
        res.status(201).json(adocao);
    } catch (err) { res.status(400).json({ error: err.message }); }
});

app.get('/adocoes', autenticar, async (req, res) => {
    if (!checarBanco(res)) return;
    try {
        const { pagina, limite } = parsePaginacao(req.query);
        const { dados, total } = await adocoesService.listarPara(req.usuario, { pagina, limite });
        res.json(montarResposta(dados, total, pagina, limite));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/adocoes/:id/status', autenticar, exigirAdmin, async (req, res) => {
    if (!checarBanco(res)) return;
    try {
        const adocao = await adocoesService.atualizarStatus(req.params.id, req.body.status);
        if (!adocao) return res.status(404).json({ error: 'Solicitação não encontrada' });
        res.json(adocao);
    } catch (err) { res.status(400).json({ error: err.message }); }
});

// ============================================================
// VOLUNTARIADO
// ============================================================

app.post('/voluntarios', async (req, res) => {
    if (!checarBanco(res)) return;
    const { nome, telefone, tipo, cidade, mensagem } = req.body;
    if (!nome || !telefone) return res.status(400).json({ error: 'Nome e telefone são obrigatórios' });
    try {
        const voluntario = await voluntariosRepo.criar({ nome, telefone, tipo, cidade, mensagem });
        res.status(201).json({ message: 'Cadastro recebido!', id: voluntario.id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/voluntarios', autenticar, exigirAdmin, async (req, res) => {
    if (!checarBanco(res)) return;
    try {
        res.json(await voluntariosRepo.listar());
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================================
// OCORRÊNCIAS
// ============================================================

app.post('/denuncia', limitarPorIp(5, 60 * 60 * 1000), async (req, res) => {
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

// Rastreamento público por protocolo — quem denunciou consegue conferir o
// status de qualquer navegador/dispositivo, sem precisar de login. Não
// devolve o nome do denunciante nem o relato completo (só quem denunciou
// sabe o protocolo, mas mesmo assim não expomos identidade publicamente).
app.get('/ocorrencias/protocolo/:protocolo', async (req, res) => {
    if (!checarBanco(res)) return;
    try {
        const r = await db.query(
            'SELECT protocolo, tipo, localizacao, status, criado_em, atualizado_em FROM ocorrencias WHERE protocolo=$1',
            [req.params.protocolo.toUpperCase()]
        );
        if (!r.rows.length) return res.status(404).json({ error: 'Protocolo não encontrado' });
        res.json(r.rows[0]);
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
