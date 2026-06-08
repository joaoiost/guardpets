-- ============================================================
--  GUARD PETS INTELLIGENCE — Banco de Dados (PostgreSQL / Supabase)
--  Cole este script no SQL Editor do Supabase e clique em Run
--
--  Formas Normais aplicadas: 1FN, 2FN, 3FN
--
--  MER — Entidades:
--    usuarios     (agentes cadastrados)
--    animais      (animais resgatados)
--    ocorrencias  (denúncias / resgates)
--    agendamentos (solicitações de adoção)
--
--  Relacionamentos:
--    agendamentos.animal_id → animais.id  (N:1)
-- ============================================================

-- ============================================================
--  TABELA: usuarios
--  PK:  id (SERIAL)
--  UQ:  email, cpf
--  NOT NULL: nome, email, senha
--  CHECK: tipo IN ('usuario', 'admin')
--
--  1FN: campos atômicos
--  2FN: PK simples, sem dependência parcial
--  3FN: sem dependência transitiva
-- ============================================================
CREATE TABLE IF NOT EXISTS usuarios (
    id            SERIAL          PRIMARY KEY,
    nome          VARCHAR(100)    NOT NULL,
    sobrenome     VARCHAR(100)    NOT NULL DEFAULT '',
    cpf           VARCHAR(14)             DEFAULT NULL,     -- NULL = não informado
    email         VARCHAR(150)    NOT NULL,
    telefone      VARCHAR(20)             DEFAULT NULL,
    senha         VARCHAR(255)    NOT NULL,                 -- hash bcrypt
    especialidade VARCHAR(50)     NOT NULL DEFAULT 'Visitante',
    tipo          VARCHAR(10)     NOT NULL DEFAULT 'usuario'
                                  CHECK (tipo IN ('usuario', 'admin')),
    ativo         BOOLEAN         NOT NULL DEFAULT TRUE,
    criado_em     TIMESTAMP       NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_usuarios_email UNIQUE (email),
    CONSTRAINT uq_usuarios_cpf   UNIQUE (cpf)               -- NULL não viola UNIQUE no PostgreSQL
);

-- ============================================================
--  TABELA: animais
--  PK:  id (SERIAL)
--  CHECK: status restrito a valores válidos
--
--  1FN: campos atômicos
--  2FN: sem dependência parcial
--  3FN: sem dependência transitiva
-- ============================================================
CREATE TABLE IF NOT EXISTS animais (
    id                SERIAL          PRIMARY KEY,
    nome              VARCHAR(100)    NOT NULL,
    especie           VARCHAR(50)     NOT NULL DEFAULT 'Não informado',
    raca              VARCHAR(100)             DEFAULT 'SRD',
    descricao         TEXT                     DEFAULT NULL,
    status            VARCHAR(30)     NOT NULL DEFAULT 'Resgatado'
                                      CHECK (status IN (
                                          'Resgatado',
                                          'Em Tratamento',
                                          'Reabilitado',
                                          'Adotado',
                                          'Urgente'
                                      )),
    castrado          BOOLEAN         NOT NULL DEFAULT FALSE,
    vacinado          BOOLEAN         NOT NULL DEFAULT FALSE,
    disponivel_adocao BOOLEAN         NOT NULL DEFAULT TRUE,
    imagem            VARCHAR(255)             DEFAULT NULL,
    registrado_em     TIMESTAMP       NOT NULL DEFAULT NOW()
);

-- ============================================================
--  TABELA: ocorrencias
--  PK:  id (SERIAL)
--  UQ:  protocolo
--  Trigger: atualiza atualizado_em automaticamente
--
--  1FN: campos atômicos
--  2FN: sem dependência parcial
--  3FN: sem dependência transitiva
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

-- Função e trigger para atualizar atualizado_em automaticamente
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
--  TABELA: agendamentos
--  PK:  id (SERIAL)
--  UQ:  protocolo
--  FK:  animal_id → animais(id)  ON DELETE SET NULL
--
--  Restrição Referencial: se o animal for removido,
--  animal_id recebe NULL (histórico do adotante é preservado)
--
--  1FN: campos atômicos
--  2FN: sem dependência parcial
--  3FN: nome_adotante/telefone dependem só do id do agendamento
-- ============================================================
CREATE TABLE IF NOT EXISTS agendamentos (
    id            SERIAL          PRIMARY KEY,
    protocolo     VARCHAR(20)     NOT NULL UNIQUE,
    nome_adotante VARCHAR(100)    NOT NULL,
    telefone      VARCHAR(20)              DEFAULT NULL,
    residencia    VARCHAR(255)             DEFAULT NULL,
    motivacao     TEXT                     DEFAULT NULL,
    animal_id     INTEGER                  DEFAULT NULL
                                  REFERENCES animais(id)
                                  ON DELETE SET NULL,
    status        VARCHAR(50)     NOT NULL DEFAULT 'Aguardando Análise',
    criado_em     TIMESTAMP       NOT NULL DEFAULT NOW()
);

-- ============================================================
--  DADOS INICIAIS
-- ============================================================
INSERT INTO animais (nome, especie, raca, status, castrado, vacinado, disponivel_adocao)
VALUES
    ('Apolo', 'Cachorro', 'Pitbull',       'Resgatado',   FALSE, TRUE,  TRUE),
    ('Luna',  'Gato',     'Felino',        'Urgente',     FALSE, FALSE, TRUE),
    ('Thor',  'Cachorro', 'Pastor Alemão', 'Reabilitado', TRUE,  TRUE,  TRUE)
ON CONFLICT DO NOTHING;
