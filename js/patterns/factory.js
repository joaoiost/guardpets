/**
 * =============================================================
 *  PADRÃO FACTORY — EntidadeFactory
 * =============================================================
 *  Centraliza a criação de todos os objetos do sistema.
 *  Em vez de criar objetos diretamente com literais em várias
 *  partes do código, usamos sempre: EntidadeFactory.criar<Tipo>()
 *
 *  Benefício: se a estrutura de um objeto mudar, basta alterar
 *  aqui — e não em cada lugar onde era criado manualmente.
 *
 *  Objetos criados:
 *   - Usuário comum
 *   - Administrador
 *   - Animal
 *   - Ocorrência de resgate / denúncia
 *   - Agendamento de castração
 * =============================================================
 */

class EntidadeFactory {

    // ---------------------------------------------------------
    //  Helpers internos
    // ---------------------------------------------------------

    /**
     * Gera um ID único combinando timestamp e número aleatório.
     * @param {string} prefixo - Prefixo para identificar o tipo (ex: "usr", "oc")
     * @returns {string}
     */
    static #gerarId(prefixo = 'id') {
        const timestamp = Date.now().toString(36);      // base 36 = mais curto
        const aleatorio = Math.random().toString(36).slice(2, 7);
        return `${prefixo}_${timestamp}_${aleatorio}`;
    }

    /**
     * Retorna a data e hora atual no formato ISO.
     * @returns {string}
     */
    static #agora() {
        return new Date().toISOString();
    }

    // ---------------------------------------------------------
    //  USUÁRIO COMUM
    // ---------------------------------------------------------

    /**
     * Cria um objeto de usuário comum padronizado.
     * @param {object} dados - { nome, sobrenome, cpf, email, senha, especialidade }
     * @returns {object} Objeto usuário
     *
     * [FACTORY] — centraliza criação de usuário comum
     */
    static criarUsuario(dados = {}) {
        const usuario = {
            id:           EntidadeFactory.#gerarId('usr'),
            tipo:         'usuario',                         // Diferencia de admin
            nome:         (dados.nome || '').trim(),
            sobrenome:    (dados.sobrenome || '').trim(),
            cpf:          (dados.cpf || '').trim(),
            email:        (dados.email || '').trim().toLowerCase(),
            senha:        dados.senha || '',                 // Em produção: hash
            especialidade: dados.especialidade || 'Visitante',
            ativo:        true,
            criadoEm:     EntidadeFactory.#agora(),
        };

        console.log('[Factory] Usuário criado:', usuario.email, '| Tipo:', usuario.tipo);
        return usuario;
    }

    // ---------------------------------------------------------
    //  ADMINISTRADOR
    // ---------------------------------------------------------

    /**
     * Cria um objeto de administrador com permissões elevadas.
     * Herda do usuário comum, mas com tipo = 'admin' e permissões extras.
     * @param {object} dados - { nome, email, senha, nivel }
     * @returns {object} Objeto administrador
     *
     * [FACTORY] — centraliza criação de administrador
     */
    static criarAdmin(dados = {}) {
        // Reaproveita a Factory de usuário e eleva as permissões
        const admin = EntidadeFactory.criarUsuario(dados);
        admin.id          = EntidadeFactory.#gerarId('adm');
        admin.tipo        = 'admin';
        admin.nivel       = dados.nivel || 1;           // 1 = básico, 2 = super
        admin.permissoes  = {
            gerenciarAnimais:    true,
            gerenciarUsuarios:   true,
            atualizarStatus:     true,
            verRelatorios:       true,
        };

        console.log('[Factory] Admin criado:', admin.email, '| Nível:', admin.nivel);
        return admin;
    }

    // ---------------------------------------------------------
    //  ANIMAL
    // ---------------------------------------------------------

    /**
     * Cria um objeto de animal para adoção.
     * @param {object} dados - { nome, especie, raca, descricao, status, imagem }
     * @returns {object} Objeto animal
     *
     * [FACTORY] — centraliza criação de animal
     */
    static criarAnimal(dados = {}) {
        // Status possíveis de um animal no sistema
        const statusValidos = ['Resgatado', 'Em Tratamento', 'Reabilitado', 'Adotado', 'Urgente'];
        const status        = statusValidos.includes(dados.status) ? dados.status : 'Resgatado';

        const animal = {
            id:                   EntidadeFactory.#gerarId('ani'),
            nome:                 (dados.nome || 'Sem Nome').trim(),
            especie:              dados.especie || 'Não informado',
            raca:                 dados.raca    || 'SRD (Sem Raça Definida)',
            descricao:            dados.descricao || '',
            status,
            castrado:             dados.castrado ?? false,
            vacinado:             dados.vacinado  ?? false,
            disponivelParaAdocao: dados.disponivelParaAdocao ?? true,
            imagem:               dados.imagem   || '',
            registradoEm:         EntidadeFactory.#agora(),
        };

        console.log('[Factory] Animal criado:', animal.nome, '| Status:', animal.status);
        return animal;
    }

    // ---------------------------------------------------------
    //  OCORRÊNCIA (Denúncia / Resgate)
    // ---------------------------------------------------------

    /**
     * Cria um objeto de ocorrência de maus-tratos ou resgate.
     * Inicia sempre com status "Registrado".
     * @param {object} dados - { nome, localizacao, tipo, relato }
     * @returns {object} Objeto ocorrência
     *
     * [FACTORY] — centraliza criação de ocorrência
     */
    static criarOcorrencia(dados = {}) {
        // Possíveis status do ciclo de vida de um resgate (usado pelo Observer)
        const STATUS_POSSIVEIS = [
            'Registrado',
            'Em Análise',
            'Equipe Acionada',
            'Resgatado',
            'Encaminhado para Adoção',
        ];

        const ocorrencia = {
            id:            EntidadeFactory.#gerarId('oc'),
            protocolo:     `GP-${Date.now().toString().slice(-6)}`, // ex: GP-123456
            tipo:          dados.tipo        || 'Agressão Física',
            localizacao:   dados.localizacao || '',
            relato:        dados.relato      || '',
            denunciante:   dados.nome        || 'Anônimo',
            status:        STATUS_POSSIVEIS[0],               // Sempre começa como "Registrado"
            statusPossiveis: STATUS_POSSIVEIS,
            criadoEm:      EntidadeFactory.#agora(),
            atualizadoEm:  EntidadeFactory.#agora(),
        };

        console.log('[Factory] Ocorrência criada:', ocorrencia.protocolo, '| Status:', ocorrencia.status);
        return ocorrencia;
    }

    // ---------------------------------------------------------
    //  AGENDAMENTO DE CASTRAÇÃO
    // ---------------------------------------------------------

    /**
     * Cria um objeto de agendamento de adoção / castração.
     * @param {object} dados - { nomeAdotante, telefone, residencia, motivacao, petNome }
     * @returns {object} Objeto agendamento
     *
     * [FACTORY] — centraliza criação de agendamento
     */
    static criarAgendamento(dados = {}) {
        const agendamento = {
            id:           EntidadeFactory.#gerarId('ag'),
            protocolo:    `AD-${Date.now().toString().slice(-6)}`, // ex: AD-789012
            nomeAdotante: dados.nomeAdotante || '',
            telefone:     dados.telefone     || '',
            residencia:   dados.residencia   || '',
            motivacao:    dados.motivacao    || '',
            petNome:      dados.petNome      || '',
            status:       'Aguardando Análise',
            criadoEm:     EntidadeFactory.#agora(),
        };

        console.log('[Factory] Agendamento criado:', agendamento.protocolo, '| Pet:', agendamento.petNome);
        return agendamento;
    }
}

// Disponibiliza globalmente para uso em index1.js e outros módulos
window.EntidadeFactory = EntidadeFactory;
console.log('[Factory] Módulo carregado. Use: EntidadeFactory.criar<Tipo>()');
