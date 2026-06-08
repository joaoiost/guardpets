/**
 * =============================================================
 *  PADRÃO OBSERVER — GerenciadorEventos
 * =============================================================
 *  Implementa o padrão Observer para notificar partes do sistema
 *  quando eventos importantes acontecem (ex: status de resgate
 *  sendo alterado).
 *
 *  Como funciona:
 *   - Qualquer módulo pode SE INSCREVER em um evento (subscribe)
 *   - Quando o evento ocorre, todos os inscritos são NOTIFICADOS
 *   - O BancoDeDados chama notificar() ao alterar status
 *
 *  Eventos disponíveis:
 *   - 'status_ocorrencia_alterado' → toast de mudança de status
 *   - 'nova_ocorrencia'            → toast de nova denúncia registrada
 *   - 'novo_usuario'               → toast de cadastro realizado
 *   - 'novo_agendamento'           → toast de adoção solicitada
 * =============================================================
 */

class GerenciadorEventos {

    constructor() {
        // Dicionário: { nomeEvento: [callback1, callback2, ...] }
        this._observadores = {};

        // Fila de toasts para não sobrepor vários ao mesmo tempo
        this._filaToasts = [];
        this._exibindoToast = false;

        // Cria o container de toasts no DOM ao instanciar
        this._criarContainerToast();

        console.log('[Observer] GerenciadorEventos inicializado.');
    }

    // ---------------------------------------------------------
    //  Inscrição / Cancelamento (Subscribe / Unsubscribe)
    // ---------------------------------------------------------

    /**
     * Inscreve um callback para ser chamado quando o evento ocorrer.
     * [OBSERVER] — método subscribe
     *
     * @param {string}   evento   - Nome do evento (ex: 'status_ocorrencia_alterado')
     * @param {Function} callback - Função chamada com os dados do evento
     * @returns {Function} Função para cancelar a inscrição
     */
    inscrever(evento, callback) {
        if (!this._observadores[evento]) {
            this._observadores[evento] = [];
        }
        this._observadores[evento].push(callback);

        console.log(`[Observer] Inscrito em '${evento}'. Total: ${this._observadores[evento].length}`);

        // Retorna função de cancelamento (conveniente para cleanup)
        return () => this.cancelar(evento, callback);
    }

    /**
     * Remove um observador de um evento específico.
     * [OBSERVER] — método unsubscribe
     */
    cancelar(evento, callback) {
        if (!this._observadores[evento]) return;
        this._observadores[evento] = this._observadores[evento].filter(cb => cb !== callback);
        console.log(`[Observer] Inscrito removido de '${evento}'.`);
    }

    /**
     * Notifica todos os observadores de um evento.
     * [OBSERVER] — método notify
     *
     * @param {string} evento - Nome do evento
     * @param {object} dados  - Dados enviados a cada observador
     */
    notificar(evento, dados = {}) {
        const callbacks = this._observadores[evento] || [];
        console.log(`[Observer] Notificando '${evento}' para ${callbacks.length} observador(es).`, dados);

        callbacks.forEach(callback => {
            try {
                callback(dados);
            } catch (err) {
                console.error(`[Observer] Erro no callback de '${evento}':`, err);
            }
        });
    }

    // ---------------------------------------------------------
    //  Sistema de Toast Visual
    // ---------------------------------------------------------

    /**
     * Cria o container de toasts no DOM (chamado uma vez no constructor).
     */
    _criarContainerToast() {
        if (document.getElementById('gp-toast-container')) return;

        const container = document.createElement('div');
        container.id = 'gp-toast-container';
        container.setAttribute('aria-live', 'polite'); // Acessibilidade
        document.body.appendChild(container);
    }

    /**
     * Exibe um toast com mensagem e tipo visual.
     * [OBSERVER] — notificação visual disparada pelos eventos
     *
     * @param {string} titulo   - Título do toast
     * @param {string} mensagem - Mensagem detalhada
     * @param {string} tipo     - 'sucesso' | 'alerta' | 'info' | 'erro'
     * @param {number} duracao  - Duração em ms (padrão: 4000)
     */
    exibirToast(titulo, mensagem, tipo = 'info', duracao = 4500) {
        this._filaToasts.push({ titulo, mensagem, tipo, duracao });
        if (!this._exibindoToast) {
            this._processarFila();
        }
    }

    /**
     * Processa a fila de toasts sequencialmente.
     */
    _processarFila() {
        if (this._filaToasts.length === 0) {
            this._exibindoToast = false;
            return;
        }

        this._exibindoToast = true;
        const { titulo, mensagem, tipo, duracao } = this._filaToasts.shift();

        const container = document.getElementById('gp-toast-container');
        if (!container) return;

        // Ícones por tipo
        const icones = {
            sucesso: '✅',
            alerta:  '⚠️',
            info:    'ℹ️',
            erro:    '❌',
        };

        const toast = document.createElement('div');
        toast.className = `gp-toast gp-toast--${tipo}`;
        toast.innerHTML = `
            <div class="gp-toast__icone">${icones[tipo] || 'ℹ️'}</div>
            <div class="gp-toast__conteudo">
                <strong class="gp-toast__titulo">${titulo}</strong>
                <span class="gp-toast__mensagem">${mensagem}</span>
            </div>
            <button class="gp-toast__fechar" aria-label="Fechar notificação">&times;</button>
        `;

        // Botão de fechar manualmente
        toast.querySelector('.gp-toast__fechar').addEventListener('click', () => {
            this._removerToast(toast);
        });

        container.appendChild(toast);

        // Animação de entrada (micro-delay para o CSS pegar)
        requestAnimationFrame(() => {
            requestAnimationFrame(() => toast.classList.add('gp-toast--visivel'));
        });

        // Auto-remover após duração
        const timer = setTimeout(() => this._removerToast(toast), duracao);
        toast._timer = timer;

        // Processar próximo toast após este fechar
        setTimeout(() => this._processarFila(), duracao + 600);
    }

    /**
     * Remove um toast do DOM com animação de saída.
     */
    _removerToast(toast) {
        if (!toast || !toast.parentNode) return;
        clearTimeout(toast._timer);
        toast.classList.remove('gp-toast--visivel');
        toast.classList.add('gp-toast--saindo');
        setTimeout(() => toast.remove(), 500);
    }

    // ---------------------------------------------------------
    //  Registro dos Observadores Padrão do Sistema
    // ---------------------------------------------------------

    /**
     * Registra todos os observadores padrão do Guard Pets.
     * Chamado uma vez ao inicializar a aplicação.
     */
    registrarObservadoresPadrao() {
        // === OBSERVER 1: Mudança de status de ocorrência ===
        this.inscrever('status_ocorrencia_alterado', (dados) => {
            const { protocolo } = dados.ocorrencia;
            const { novoStatus } = dados;

            // Define ícone e tipo do toast conforme o novo status
            const configStatus = {
                'Registrado':              { tipo: 'info',    icone: '📋' },
                'Em Análise':              { tipo: 'info',    icone: '🔍' },
                'Equipe Acionada':         { tipo: 'alerta',  icone: '🚨' },
                'Resgatado':               { tipo: 'sucesso', icone: '🐾' },
                'Encaminhado para Adoção': { tipo: 'sucesso', icone: '🏠' },
            };

            const cfg = configStatus[novoStatus] || { tipo: 'info', icone: '📢' };

            this.exibirToast(
                `${cfg.icone} Status Atualizado`,
                `Protocolo <strong>${protocolo}</strong>: ${novoStatus}`,
                cfg.tipo
            );

            // Atualiza a área de status na tela, se existir
            this._atualizarAreaStatus(dados.ocorrencia);
        });

        // === OBSERVER 2: Nova ocorrência registrada ===
        this.inscrever('nova_ocorrencia', (dados) => {
            this.exibirToast(
                '📋 Denúncia Registrada',
                `Protocolo <strong>${dados.protocolo}</strong> enviado ao comando.`,
                'sucesso'
            );
        });

        // === OBSERVER 3: Novo usuário cadastrado ===
        this.inscrever('novo_usuario', (dados) => {
            this.exibirToast(
                '🎖️ Agente Cadastrado',
                `Bem-vindo(a), <strong>${dados.nome}</strong>! Conta criada com sucesso.`,
                'sucesso'
            );
        });

        // === OBSERVER 4: Novo agendamento de adoção ===
        this.inscrever('novo_agendamento', (dados) => {
            this.exibirToast(
                '🐾 Solicitação Enviada',
                `Prontuário de <strong>${dados.petNome}</strong> solicitado! Protocolo: ${dados.protocolo}`,
                'sucesso'
            );
        });

        console.log('[Observer] Todos os observadores padrão registrados.');
    }

    /**
     * Atualiza a área visual de status de ocorrências na seção de denúncia.
     * @param {object} ocorrencia - Objeto ocorrência atualizado
     */
    _atualizarAreaStatus(ocorrencia) {
        const areaStatus = document.getElementById('area-status-ocorrencias');
        if (!areaStatus) return;

        // Verifica se já existe um item para esta ocorrência
        let itemExistente = areaStatus.querySelector(`[data-id="${ocorrencia.id}"]`);

        const statusClasse = {
            'Registrado':              'status--registrado',
            'Em Análise':              'status--analise',
            'Equipe Acionada':         'status--acionada',
            'Resgatado':               'status--resgatado',
            'Encaminhado para Adoção': 'status--adocao',
        };

        const classe = statusClasse[ocorrencia.status] || 'status--registrado';

        const html = `
            <div class="status-badge ${classe}">
                <span class="status-protocolo">${ocorrencia.protocolo}</span>
                <span class="status-texto">${ocorrencia.status}</span>
            </div>
        `;

        if (itemExistente) {
            itemExistente.innerHTML = html;
        } else {
            const novoItem = document.createElement('div');
            novoItem.dataset.id = ocorrencia.id;
            novoItem.innerHTML  = html;
            areaStatus.insertBefore(novoItem, areaStatus.firstChild);
        }
    }
}

// Cria e exporta a instância global do GerenciadorEventos
window.GerenciadorEventos = new GerenciadorEventos();

// Registra os observadores padrão do sistema
window.GerenciadorEventos.registrarObservadoresPadrao();

console.log('[Observer] Módulo carregado. Use: GerenciadorEventos.exibirToast() ou .inscrever()');
