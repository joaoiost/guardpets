-- ============================================================
--  GUARD PETS — Banco de Dados (PostgreSQL / Supabase)
--  Cole este script no SQL Editor do Supabase e clique em Run
--
--  Formas Normais aplicadas: 1FN, 2FN, 3FN
--
--  MER — Entidades:
--    usuarios     (adotantes e administradores)
--    animais      (animais resgatados/disponíveis)
--    ocorrencias  (denúncias / resgates)
--    adocoes      (solicitações de adoção)
--
--  Relacionamentos:
--    adocoes.id_animal   → animais.id   (N:1)
--    adocoes.id_usuario  → usuarios.id  (N:1)
--    usuarios.auth_id    → auth.users.id (1:1, ponte com Supabase Auth p/ RLS)
-- ============================================================

-- ============================================================
--  TABELA: usuarios
--  PK:  id (SERIAL)
--  UQ:  email, cpf, auth_id
--  NOT NULL: nome, email, senha
--  CHECK: tipo IN ('adotante', 'admin')
--
--  auth_id liga esta linha ao usuário do Supabase Auth (auth.users),
--  necessário pra política de RLS saber "quem" está fazendo a query
--  (auth.uid() só existe quando o acesso passa pelo Supabase Auth).
--
--  1FN: campos atômicos | 2FN: PK simples | 3FN: sem dependência transitiva
-- ============================================================
CREATE TABLE IF NOT EXISTS usuarios (
    id            SERIAL          PRIMARY KEY,
    auth_id       UUID                     DEFAULT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    nome          VARCHAR(100)    NOT NULL,
    sobrenome     VARCHAR(100)    NOT NULL DEFAULT '',
    cpf           VARCHAR(14)              DEFAULT NULL,     -- NULL = não informado
    email         VARCHAR(150)    NOT NULL,
    telefone      VARCHAR(20)              DEFAULT NULL,
    senha         VARCHAR(255)             DEFAULT NULL,      -- hash bcrypt (NULL quando o login é 100% via Supabase Auth)
    especialidade VARCHAR(50)     NOT NULL DEFAULT 'Visitante',
    tipo          VARCHAR(10)     NOT NULL DEFAULT 'adotante'
                                  CHECK (tipo IN ('adotante', 'admin')),
    ativo         BOOLEAN         NOT NULL DEFAULT TRUE,
    criado_em     TIMESTAMP       NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_usuarios_email   UNIQUE (email),
    CONSTRAINT uq_usuarios_cpf     UNIQUE (cpf),
    CONSTRAINT uq_usuarios_authid  UNIQUE (auth_id),
    CONSTRAINT ck_usuarios_credencial CHECK (senha IS NOT NULL OR auth_id IS NOT NULL)
);

-- ============================================================
--  TABELA: animais
--  PK:  id (SERIAL)
--  CHECK: porte e status restritos a valores válidos
--
--  1FN: campos atômicos | 2FN: sem dependência parcial | 3FN: sem dependência transitiva
-- ============================================================
CREATE TABLE IF NOT EXISTS animais (
    id                SERIAL          PRIMARY KEY,
    nome              VARCHAR(100)    NOT NULL,
    especie           VARCHAR(50)     NOT NULL DEFAULT 'Não informado',
    raca              VARCHAR(100)             DEFAULT 'SRD',
    porte             VARCHAR(20)     NOT NULL DEFAULT 'Médio'
                                      CHECK (porte IN ('Pequeno', 'Médio', 'Grande')),
    idade             VARCHAR(20)     NOT NULL DEFAULT 'Não informado'
                                      CHECK (idade IN ('Filhote', 'Jovem', 'Adulto', 'Idoso', 'Não informado')),
    saude             VARCHAR(255)             DEFAULT NULL,     -- ex.: "Saudável", "Em tratamento (verminose)"
    castrado          BOOLEAN         NOT NULL DEFAULT FALSE,
    vacinado          BOOLEAN         NOT NULL DEFAULT FALSE,
    descricao         TEXT                     DEFAULT NULL,
    localizacao       VARCHAR(255)             DEFAULT NULL,     -- cidade/região do animal
    foto_url          TEXT                     DEFAULT NULL,     -- URL pública no Supabase Storage
    situacao          VARCHAR(20)     NOT NULL DEFAULT 'Resgatado' -- etapa do resgate (etiqueta exibida no card)
                                      CHECK (situacao IN ('Resgatado', 'Urgente', 'Em Tratamento', 'Reabilitado')),
    status            VARCHAR(20)     NOT NULL DEFAULT 'disponivel' -- etapa da ADOÇÃO (não confundir com situacao)
                                      CHECK (status IN ('disponivel', 'em_processo', 'adotado')),
    created_at        TIMESTAMP       NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_animais_status      ON animais(status);
CREATE INDEX IF NOT EXISTS idx_animais_especie      ON animais(especie);
CREATE INDEX IF NOT EXISTS idx_animais_localizacao  ON animais(localizacao);

-- ============================================================
--  TABELA: ocorrencias  (mantida sem alterações — já em produção)
--  PK:  id (SERIAL)
--  UQ:  protocolo
-- ============================================================
CREATE TABLE IF NOT EXISTS ocorrencias (
    id               SERIAL          PRIMARY KEY,
    protocolo        VARCHAR(20)     NOT NULL UNIQUE,
    tipo             VARCHAR(100)    NOT NULL DEFAULT 'Agressão Física',
    localizacao      VARCHAR(255)    NOT NULL,
    relato           TEXT                     DEFAULT NULL,
    nome_denunciante VARCHAR(100)    NOT NULL DEFAULT 'Anônimo',
    status           VARCHAR(30)     NOT NULL DEFAULT 'Registrado'
                                     CHECK (status IN (
                                         'Registrado',
                                         'Em Análise',
                                         'Equipe Acionada',
                                         'Resgatado',
                                         'Encaminhado para Adoção'
                                     )),
    criado_em        TIMESTAMP       NOT NULL DEFAULT NOW(),
    atualizado_em    TIMESTAMP       NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION fn_atualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.atualizado_em = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ocorrencias_atualizado ON ocorrencias;
CREATE TRIGGER trg_ocorrencias_atualizado
    BEFORE UPDATE ON ocorrencias
    FOR EACH ROW EXECUTE FUNCTION fn_atualizar_timestamp();

-- ============================================================
--  TABELA: adocoes
--  PK:  id (SERIAL)
--  UQ:  protocolo
--  FK:  id_animal  → animais(id)   ON DELETE SET NULL (histórico preservado)
--  FK:  id_usuario → usuarios(id)  ON DELETE SET NULL (opcional — pedir adoção
--       NÃO exige login; se a pessoa estiver logada, guardamos o vínculo)
--
--  1FN: campos atômicos | 2FN: sem dependência parcial
--  3FN: nome/telefone/residencia/motivacao dependem só do id da própria solicitação
-- ============================================================
CREATE TABLE IF NOT EXISTS adocoes (
    id             SERIAL          PRIMARY KEY,
    protocolo      VARCHAR(20)     NOT NULL UNIQUE,
    id_animal      INTEGER                  DEFAULT NULL
                                   REFERENCES animais(id)
                                   ON DELETE SET NULL,
    id_usuario     INTEGER                  DEFAULT NULL
                                   REFERENCES usuarios(id)
                                   ON DELETE SET NULL,
    nome_adotante  VARCHAR(100)    NOT NULL,
    telefone       VARCHAR(20)              DEFAULT NULL,
    residencia     VARCHAR(255)             DEFAULT NULL,
    motivacao      TEXT                     DEFAULT NULL,
    status         VARCHAR(20)     NOT NULL DEFAULT 'pendente'
                                   CHECK (status IN ('pendente', 'aprovada', 'recusada')),
    data_solicitacao TIMESTAMP     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_adocoes_animal   ON adocoes(id_animal);
CREATE INDEX IF NOT EXISTS idx_adocoes_usuario  ON adocoes(id_usuario);

-- Regra de negócio no banco: aprovar marca o animal como "adotado",
-- recusar devolve o animal pra vitrine ("disponivel"). As DUAS pontas
-- ficam no mesmo trigger de propósito — tinha uma versão anterior onde
-- "aprovar" era regra do banco e "recusar" era regra do JS (services/
-- adocoesService.js), e as duas metades do mesmo fluxo podiam ficar
-- fora de sincronia se só uma camada fosse atualizada.
CREATE OR REPLACE FUNCTION fn_adocao_aprovada()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.id_animal IS NULL OR NEW.status = OLD.status THEN
        RETURN NEW;
    END IF;

    IF NEW.status = 'aprovada' THEN
        UPDATE animais SET status = 'adotado' WHERE id = NEW.id_animal;
    ELSIF NEW.status = 'recusada' THEN
        UPDATE animais SET status = 'disponivel' WHERE id = NEW.id_animal AND status <> 'adotado';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_adocao_aprovada ON adocoes;
CREATE TRIGGER trg_adocao_aprovada
    AFTER UPDATE ON adocoes
    FOR EACH ROW EXECUTE FUNCTION fn_adocao_aprovada();

-- ============================================================
--  TABELA: voluntarios
--  PK: id (SERIAL) — cadastro de quem quer ajudar (sem login)
-- ============================================================
CREATE TABLE IF NOT EXISTS voluntarios (
    id         SERIAL          PRIMARY KEY,
    nome       VARCHAR(100)    NOT NULL,
    telefone   VARCHAR(20)     NOT NULL,
    tipo       VARCHAR(50)     NOT NULL DEFAULT 'Outro',
    cidade     VARCHAR(100)             DEFAULT NULL,
    mensagem   TEXT                     DEFAULT NULL,
    criado_em  TIMESTAMP       NOT NULL DEFAULT NOW()
);

-- ============================================================
--  ROW LEVEL SECURITY (RLS)
--
--  IMPORTANTE: essas políticas só valem para acesso feito via
--  Supabase REST/JS (chave anon + JWT do usuário), porque é o
--  único caminho onde "auth.uid()" existe. O backend Express
--  atual (server.js) conecta no Postgres com a connection string
--  direta (role com bypass de RLS) e continua responsável por
--  checar permissão no código — as policies aqui documentam a
--  regra formalmente e valem se/quando o front passar a falar
--  direto com o Supabase.
-- ============================================================

-- Funções auxiliares SECURITY DEFINER: consultam `usuarios` ignorando RLS.
-- Sem isso, uma policy que consulta a própria tabela (ex.: "sou admin?")
-- corre risco de recursão/avaliação instável — é o padrão recomendado
-- pelo próprio Supabase para esse caso.
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
    SELECT EXISTS (SELECT 1 FROM usuarios WHERE auth_id = auth.uid() AND tipo = 'admin');
$$;

CREATE OR REPLACE FUNCTION current_usuario_id()
RETURNS INTEGER LANGUAGE sql SECURITY DEFINER STABLE AS $$
    SELECT id FROM usuarios WHERE auth_id = auth.uid() LIMIT 1;
$$;

ALTER TABLE usuarios    ENABLE ROW LEVEL SECURITY;
ALTER TABLE animais     ENABLE ROW LEVEL SECURITY;
ALTER TABLE adocoes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE voluntarios ENABLE ROW LEVEL SECURITY;

-- usuarios: cada um vê/edita só o próprio registro; admin vê todos
DROP POLICY IF EXISTS usuarios_select_proprio ON usuarios;
CREATE POLICY usuarios_select_proprio ON usuarios
    FOR SELECT USING (auth_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS usuarios_update_proprio ON usuarios;
CREATE POLICY usuarios_update_proprio ON usuarios
    FOR UPDATE USING (auth_id = auth.uid());

-- animais: leitura pública (site é vitrine aberta); escrita só admin
DROP POLICY IF EXISTS animais_select_publico ON animais;
CREATE POLICY animais_select_publico ON animais
    FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS animais_cud_admin ON animais;
CREATE POLICY animais_cud_admin ON animais
    FOR ALL USING (is_admin());

-- adocoes: qualquer um pode solicitar (não exige login — a pessoa só
-- precisa dar nome/telefone); se logado, só vê as próprias; admin vê todas.
DROP POLICY IF EXISTS adocoes_select_proprio ON adocoes;
CREATE POLICY adocoes_select_proprio ON adocoes
    FOR SELECT USING (id_usuario = current_usuario_id() OR is_admin());

DROP POLICY IF EXISTS adocoes_insert_proprio ON adocoes;
CREATE POLICY adocoes_insert_proprio ON adocoes
    FOR INSERT WITH CHECK (id_usuario IS NULL OR id_usuario = current_usuario_id());

DROP POLICY IF EXISTS adocoes_update_admin ON adocoes;
CREATE POLICY adocoes_update_admin ON adocoes
    FOR UPDATE USING (is_admin());

-- voluntarios: qualquer um pode se cadastrar; só admin lê a lista
DROP POLICY IF EXISTS voluntarios_insert_publico ON voluntarios;
CREATE POLICY voluntarios_insert_publico ON voluntarios
    FOR INSERT WITH CHECK (TRUE);

DROP POLICY IF EXISTS voluntarios_select_admin ON voluntarios;
CREATE POLICY voluntarios_select_admin ON voluntarios
    FOR SELECT USING (is_admin());

-- ============================================================
--  STORAGE — bucket público para fotos de animais.
--  Upload só por admin; qualquer um pode ver (a vitrine é pública).
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('animais', 'animais', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS animais_fotos_select_publico ON storage.objects;
CREATE POLICY animais_fotos_select_publico ON storage.objects
    FOR SELECT USING (bucket_id = 'animais');

DROP POLICY IF EXISTS animais_fotos_insert_admin ON storage.objects;
CREATE POLICY animais_fotos_insert_admin ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'animais' AND is_admin());

DROP POLICY IF EXISTS animais_fotos_delete_admin ON storage.objects;
CREATE POLICY animais_fotos_delete_admin ON storage.objects
    FOR DELETE USING (bucket_id = 'animais' AND is_admin());

-- ============================================================
--  REALTIME — habilita o Supabase a emitir eventos ao vivo
--  (INSERT/UPDATE/DELETE) nessas tabelas via WebSocket.
--  O front já escuta INSERT/UPDATE em `animais` (dado público).
--  `adocoes` fica pronta aqui, mas como tem RLS por usuário, só
--  emitiria evento pra quem estiver autenticado com o client
--  Supabase (não é o caso ainda — ver observação na entrega).
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'animais') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE animais;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'adocoes') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE adocoes;
    END IF;
END $$;

-- ============================================================
--  DADOS INICIAIS
--  Os 16 animais que já existiam fixos no HTML (#pet-grid), agora
--  como dados reais — o front passa a buscar isso pela API em vez
--  de ter os cards fixos, mas o resultado visual é o mesmo.
-- ============================================================
INSERT INTO animais (nome, especie, raca, porte, idade, situacao, saude, castrado, vacinado, descricao, localizacao, foto_url, status)
VALUES
    ('Apolo',   'Cachorro', 'Pitbull',          'Médio',   'Adulto',  'Resgatado',   'Saudável',                TRUE,  TRUE,  'Vítima de abandono em Resende. Hoje está 100% reabilitado, castrado e dócil com crianças.',        'Resende, RJ',        '/image/Bob.png', 'disponivel'),
    ('Luna',    'Gato',     'Felino',           'Pequeno', 'Adulto',  'Urgente',     'Em tratamento',           FALSE, FALSE, 'Resgatada de cativeiro insalubre. Extremamente carinhosa, busca lar calmo e tranquilo.',            'Volta Redonda, RJ',  'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=600', 'disponivel'),
    ('Thor',    'Cachorro', 'Pastor Alemão',    'Grande',  'Adulto',  'Reabilitado', 'Saudável',                TRUE,  TRUE,  'Ex-cão de guarda descartado pelo dono. Inteligente, protetor e fiel. Ideal para casa com quintal.', 'Volta Redonda, RJ',  '/image/Thor.png', 'disponivel'),
    ('Amora',   'Cachorro', 'SRD',              'Pequeno', 'Adulto',  'Reabilitado', 'Saudável',                TRUE,  TRUE,  'Encontrada ferida na rua. Totalmente recuperada, vacinada e cheia de energia para brincar.',        'Volta Redonda, RJ',  '/image/Amora.png', 'disponivel'),
    ('Bruce',   'Cachorro', 'Rottweiler',       'Grande',  'Adulto',  'Resgatado',   'Em avaliação veterinária',FALSE, TRUE,  'Resgatado de maus-tratos severos. Hoje é dócil com toda a família e ótimo com crianças.',           'Volta Redonda, RJ',  '/image/Bruce.png', 'disponivel'),
    ('Mel',     'Cachorro', 'Vira-lata',        'Médio',   'Adulto',  'Urgente',     'Em tratamento',           FALSE, FALSE, 'Abandonada grávida na rodovia. Dócil, adora colo e atenção. Precisa urgente de um lar.',            'Volta Redonda, RJ',  '/image/Mel.png', 'disponivel'),
    ('Mia',     'Gato',     'Siamês',           'Pequeno', 'Adulto',  'Reabilitado', 'Saudável',                TRUE,  TRUE,  'Resgatada de apartamento insalubre com 40 gatos. Tranquila e muito carinhosa com adultos.',         'Volta Redonda, RJ',  '/image/Mia.png', 'disponivel'),
    ('Nina',    'Cachorro', 'SRD',              'Pequeno', 'Adulto',  'Urgente',     'Em recuperação',          FALSE, FALSE, 'Atropelada e abandonada na calçada. Recuperada com sucesso, busca lar com muito carinho.',          'Volta Redonda, RJ',  '/image/Nina.png', 'disponivel'),
    ('Ravi',    'Cachorro', 'Labrador',         'Grande',  'Adulto',  'Resgatado',   'Em avaliação veterinária',FALSE, TRUE,  'Encontrado desnutrido em Itatiaia. Hoje é um gigante gentil — ama crianças e outros pets.',          'Itatiaia, RJ',       '/image/Ravi.png', 'disponivel'),
    ('Simba',   'Gato',     'Gato SRD',         'Médio',   'Adulto',  'Reabilitado', 'Saudável',                TRUE,  TRUE,  'Resgatado de colônia de rua. Castrado, vacinado e acostumado com outros animais.',                  'Volta Redonda, RJ',  '/image/Simba.png', 'disponivel'),
    ('Bolinha', 'Cachorro', 'Poodle',           'Pequeno', 'Idoso',   'Reabilitado', 'Saudável',                TRUE,  TRUE,  'Idoso de 7 anos abandonado por mudança. Calmo, treinado e ótimo para apartamento.',                 'Volta Redonda, RJ',  'https://images.unsplash.com/photo-1601979031925-424e53b6caaa?w=600', 'disponivel'),
    ('Zeca',    'Cachorro', 'Fila Brasileiro',  'Grande',  'Adulto',  'Resgatado',   'Em tratamento',           FALSE, TRUE,  'Resgatado de rinhadeiro clandestino. Em reabilitação — precisa de tutor experiente.',               'Volta Redonda, RJ',  'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=600', 'disponivel'),
    ('Lily',    'Gato',     'Angorá',           'Pequeno', 'Filhote', 'Urgente',     'Vacinação em andamento',  FALSE, FALSE, 'Filhote de 5 meses achada em caixa de papelão. Vacinação ainda em andamento.',                      'Volta Redonda, RJ',  'https://images.unsplash.com/photo-1574158622682-e40e69881006?w=600', 'disponivel'),
    ('Max',     'Cachorro', 'Bulldog Francês',  'Pequeno', 'Adulto',  'Reabilitado', 'Saudável',                TRUE,  TRUE,  'Apreendido de criadouro clandestino. Saudável, castrado e pronto para um lar com amor.',            'Volta Redonda, RJ',  'https://images.unsplash.com/photo-1583336663277-620dc1996580?w=600', 'disponivel'),
    ('Pérola',  'Gato',     'Gato SRD',         'Pequeno', 'Adulto',  'Reabilitado', 'Saudável',                TRUE,  TRUE,  'Resgatada junto com Lily. Brincalhona, adora outros gatos e crianças. Vacinação completa.',         'Volta Redonda, RJ',  'https://images.unsplash.com/photo-1533743983669-94fa5c4338ec?w=600', 'disponivel'),
    ('Tobias',  'Cachorro', 'Dogo Argentino',   'Grande',  'Adulto',  'Resgatado',   'Em recuperação nutricional',FALSE,FALSE, 'Encontrado acorrentado sem água por dias. Em recuperação nutricional. Dócil com tratamento.',       'Volta Redonda, RJ',  'https://images.unsplash.com/photo-1568572933382-74d440642117?w=600', 'disponivel')
ON CONFLICT DO NOTHING;
