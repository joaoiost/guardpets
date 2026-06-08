/**
 * =============================================================
 *  PADRÃO SINGLETON — BancoDeDados
 * =============================================================
 *  Garante que exista apenas UMA instância do banco de dados
 *  em toda a aplicação. Todos os módulos que precisarem de
 *  dados devem usar: BancoDeDados.getInstance()
 *
 *  Responsabilidades:
 *   - Persistir dados no localStorage
 *   - Gerenciar: usuários, ocorrências, agendamentos, animais
 *   - Fornecer métodos de leitura e escrita centralizados
 * =============================================================
 */

class BancoDeDados {
    // Instância única (Singleton)
    static #instancia = null;

    // Chaves usadas no localStorage
    static #CHAVES = {
        USUARIOS:      'guardpets_usuarios',
        OCORRENCIAS:   'guardpets_ocorrencias',
        AGENDAMENTOS:  'guardpets_agendamentos',
        ANIMAIS:       'guardpets_animais',
    };

    /**
     * Construtor privado — chamado apenas internamente.
     * Inicializa as coleções vazias se não existirem no localStorage.
     */
    constructor() {
        if (BancoDeDados.#instancia) {
            // Singleton: nunca permite segunda instância
            throw new Error(
                '[Singleton] Use BancoDeDados.getInstance() — não crie diretamente!'
            );
        }
        console.log('[Singleton] BancoDeDados inicializado.');
        this._inicializarArmazenamento();
    }

    /**
     * Ponto de acesso global ao Singleton.
     * Cria a instância na primeira chamada; retorna a existente nas demais.
     * @returns {BancoDeDados}
     */
    static getInstance() {
        if (!BancoDeDados.#instancia) {
            BancoDeDados.#instancia = new BancoDeDados();
        }
        return BancoDeDados.#instancia;
    }

    // ---------------------------------------------------------
    //  Inicialização
    // ---------------------------------------------------------

    /**
     * Garante que todas as coleções existam no localStorage.
     * Preserva dados já existentes.
     */
    _inicializarArmazenamento() {
        const chaves = BancoDeDados.#CHAVES;
        for (const chave of Object.values(chaves)) {
            if (!localStorage.getItem(chave)) {
                localStorage.setItem(chave, JSON.stringify([]));
            }
        }

        // Adiciona animais padrão se não existirem
        if (this.getAnimais().length === 0) {
            const animaisPadrao = [
                { id: 'a1', nome: 'Apolo', especie: 'Cachorro', raca: 'Pitbull', status: 'Resgatado', disponivelParaAdocao: true },
                { id: 'a2', nome: 'Luna',  especie: 'Gato',     raca: 'Felino',  status: 'Urgente',   disponivelParaAdocao: true },
                { id: 'a3', nome: 'Thor',  especie: 'Cachorro', raca: 'Pastor Alemão', status: 'Reabilitado', disponivelParaAdocao: true },
            ];
            localStorage.setItem(chaves.ANIMAIS, JSON.stringify(animaisPadrao));
        }
    }

    // ---------------------------------------------------------
    //  Helpers de localStorage
    // ---------------------------------------------------------

    _ler(chave) {
        try {
            return JSON.parse(localStorage.getItem(chave)) || [];
        } catch {
            return [];
        }
    }

    _salvar(chave, dados) {
        localStorage.setItem(chave, JSON.stringify(dados));
    }

    // ---------------------------------------------------------
    //  USUÁRIOS
    // ---------------------------------------------------------

    getUsuarios() {
        return this._ler(BancoDeDados.#CHAVES.USUARIOS);
    }

    adicionarUsuario(usuario) {
        const lista = this.getUsuarios();
        lista.push(usuario);
        this._salvar(BancoDeDados.#CHAVES.USUARIOS, lista);
        console.log('[Singleton] Usuário salvo:', usuario.email);
        return usuario;
    }

    buscarUsuarioPorEmail(email) {
        return this.getUsuarios().find(u => u.email === email) || null;
    }

    // ---------------------------------------------------------
    //  OCORRÊNCIAS (Denúncias / Resgates)
    // ---------------------------------------------------------

    getOcorrencias() {
        return this._ler(BancoDeDados.#CHAVES.OCORRENCIAS);
    }

    adicionarOcorrencia(ocorrencia) {
        const lista = this.getOcorrencias();
        lista.push(ocorrencia);
        this._salvar(BancoDeDados.#CHAVES.OCORRENCIAS, lista);
        console.log('[Singleton] Ocorrência salva:', ocorrencia.id);
        return ocorrencia;
    }

    /**
     * Atualiza o status de uma ocorrência pelo ID.
     * Dispara evento do Observer para notificação visual.
     * @param {string} id - ID da ocorrência
     * @param {string} novoStatus - Novo status do resgate
     * @returns {object|null} ocorrência atualizada ou null
     */
    atualizarStatusOcorrencia(id, novoStatus) {
        const lista = this.getOcorrencias();
        const idx   = lista.findIndex(o => o.id === id);
        if (idx === -1) {
            console.warn('[Singleton] Ocorrência não encontrada:', id);
            return null;
        }

        const statusAntigo     = lista[idx].status;
        lista[idx].status      = novoStatus;
        lista[idx].atualizadoEm = new Date().toISOString();
        this._salvar(BancoDeDados.#CHAVES.OCORRENCIAS, lista);

        console.log(`[Singleton] Status atualizado: ${statusAntigo} → ${novoStatus}`);

        // === OBSERVER: notifica todos os observadores sobre a mudança ===
        if (window.GerenciadorEventos) {
            window.GerenciadorEventos.notificar('status_ocorrencia_alterado', {
                id,
                statusAntigo,
                novoStatus,
                ocorrencia: lista[idx],
            });
        }

        return lista[idx];
    }

    // ---------------------------------------------------------
    //  AGENDAMENTOS
    // ---------------------------------------------------------

    getAgendamentos() {
        return this._ler(BancoDeDados.#CHAVES.AGENDAMENTOS);
    }

    adicionarAgendamento(agendamento) {
        const lista = this.getAgendamentos();
        lista.push(agendamento);
        this._salvar(BancoDeDados.#CHAVES.AGENDAMENTOS, lista);
        console.log('[Singleton] Agendamento salvo:', agendamento.id);
        return agendamento;
    }

    // ---------------------------------------------------------
    //  ANIMAIS
    // ---------------------------------------------------------

    getAnimais() {
        return this._ler(BancoDeDados.#CHAVES.ANIMAIS);
    }

    adicionarAnimal(animal) {
        const lista = this.getAnimais();
        lista.push(animal);
        this._salvar(BancoDeDados.#CHAVES.ANIMAIS, lista);
        console.log('[Singleton] Animal registrado:', animal.nome);
        return animal;
    }

    // ---------------------------------------------------------
    //  Utilitários
    // ---------------------------------------------------------

    /**
     * Retorna um resumo de tudo que está armazenado.
     * Útil para debug no console do navegador.
     */
    resumo() {
        return {
            usuarios:     this.getUsuarios().length,
            ocorrencias:  this.getOcorrencias().length,
            agendamentos: this.getAgendamentos().length,
            animais:      this.getAnimais().length,
        };
    }

    /**
     * Limpa todos os dados (uso exclusivo para testes).
     */
    limparTudo() {
        for (const chave of Object.values(BancoDeDados.#CHAVES)) {
            localStorage.removeItem(chave);
        }
        BancoDeDados.#instancia = null;
        console.warn('[Singleton] Todos os dados foram apagados!');
    }
}

// Exporta a instância única para uso global em toda a aplicação
window.BancoDeDados = BancoDeDados;
console.log('[Singleton] Módulo carregado. Use: BancoDeDados.getInstance()');
