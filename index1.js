/**
 * =============================================================
 *  index1.js — Lógica Principal do Guard Pets
 * =============================================================
 *  Este arquivo usa os três padrões de design:
 *
 *  [SINGLETON] BancoDeDados.getInstance()
 *    → Gerencia todos os dados no localStorage
 *
 *  [FACTORY] EntidadeFactory.criar<Tipo>()
 *    → Cria objetos padronizados (usuário, ocorrência, etc.)
 *
 *  [OBSERVER] GerenciadorEventos.notificar()
 *    → Dispara notificações visuais (toast) ao ocorrer eventos
 *
 *  As funcionalidades originais foram mantidas integralmente.
 * =============================================================
 */

document.addEventListener('DOMContentLoaded', () => {

    // =========================================================
    //  [SINGLETON] — Obtém a instância única do banco de dados
    //  Todos os dados do sistema passam por esta instância.
    // =========================================================
    const db = BancoDeDados.getInstance();
    console.log('[App] Banco de dados conectado:', db.resumo());

    // =========================================================
    //  1. CONFIGURAÇÕES INICIAIS
    // =========================================================
    AOS.init({ duration: 800, once: true });

    // Header Scroll
    window.addEventListener('scroll', () => {
        const header = document.getElementById('main-header');
        if (header) header.classList.toggle('scrolled', window.scrollY > 50);
    });

    // =========================================================
    //  2. MÁSCARAS (IMask) — mantidas do código original
    // =========================================================
    const maskOptions = {
        cpf:   { mask: '000.000.000-00' },
        phone: { mask: '(00) 00000-0000' },
        nome:  { mask: /^[a-zA-ZÀ-ÿ\s]*$/ }
    };

    const elCpf          = document.querySelector('input[name="cpf"]');
    const elPhoneReg     = document.querySelector('#form-reg input[name="telefone"]');
    const elPhoneAdopt   = document.getElementById('adopt-phone');
    const elNomeDenuncia = document.getElementById('denuncia-nome');

    if (elCpf)          IMask(elCpf, maskOptions.cpf);
    if (elPhoneReg)     IMask(elPhoneReg, maskOptions.phone);
    if (elPhoneAdopt)   IMask(elPhoneAdopt, maskOptions.phone);
    if (elNomeDenuncia) IMask(elNomeDenuncia, maskOptions.nome);

    // =========================================================
    //  3. FUNÇÕES AUXILIARES DE UI — mantidas do código original
    // =========================================================
    window.toggleAuth = (show) => {
        const modal = document.getElementById('auth-modal');
        modal.classList.toggle('active', show);
        document.body.style.overflow = show ? 'hidden' : 'auto';
    };

    window.switchAuth = (mode) => {
        const isLogin = mode === 'login';
        document.getElementById('form-login').style.display = isLogin ? 'block' : 'none';
        document.getElementById('form-reg').style.display   = isLogin ? 'none'  : 'block';
        document.getElementById('tab-login').classList.toggle('active',  isLogin);
        document.getElementById('tab-reg').classList.toggle('active',   !isLogin);
    };

    window.toggleAdopt = (show, petName = '') => {
        const modal = document.getElementById('adopt-modal');
        if (show) {
            document.getElementById('target-pet-name').innerText = 'ANIMAL: ' + petName.toUpperCase();
            // Armazena o nome do pet selecionado para uso no Factory ao submeter
            modal.dataset.petName = petName;
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        } else {
            modal.classList.remove('active');
            document.body.style.overflow = 'auto';
        }
    };

    // =========================================================
    //  4. VALIDAÇÃO DE CAMPOS — mantida do código original
    // =========================================================
    const setupValidation = (inputSelector, minLength, isEmail = false) => {
        const input = document.querySelector(inputSelector);
        if (!input) return;

        input.addEventListener('input', () => {
            let isValid = input.value.trim().length >= minLength;
            if (isEmail) isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value);

            if (isValid) {
                input.style.borderColor = '#27ae60';
                input.classList.add('valid');
            } else {
                input.style.borderColor = 'rgba(255,255,255,0.1)';
                input.classList.remove('valid');
            }
            checkAllForms();
        });
    };

    setupValidation('#denuncia-local',             5);
    setupValidation('#denuncia-relato',            10);
    setupValidation('#form-reg input[name="email"]', 5, true);
    setupValidation('#form-reg input[name="senha"]', 8);

    function checkAllForms() {
        const btnDenuncia    = document.getElementById('btn-denuncia');
        const denunciaValida = document.getElementById('denuncia-local')?.classList.contains('valid') &&
                               document.getElementById('denuncia-relato')?.classList.contains('valid');
        if (btnDenuncia) {
            btnDenuncia.disabled      = !denunciaValida;
            btnDenuncia.style.opacity = denunciaValida ? '1' : '0.5';
        }
    }

    // =========================================================
    //  5. ENVIO DOS FORMULÁRIOS — integrado com Factory + Singleton + Observer
    // =========================================================

    // ---------------------------------------------------------
    //  5a. FORMULÁRIO DE DENÚNCIA
    //  [FACTORY]   → criarOcorrencia() cria o objeto padronizado
    //  [SINGLETON] → db.adicionarOcorrencia() salva no localStorage
    //  [OBSERVER]  → notificar('nova_ocorrencia') dispara o toast
    // ---------------------------------------------------------
    const formDenuncia = document.getElementById('form-denuncia');
    if (formDenuncia) {
        formDenuncia.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn          = formDenuncia.querySelector('button[type="submit"]');
            const textoOriginal = btn.innerHTML;

            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ENVIANDO...';
            btn.disabled  = true;

            try {
                // Simula delay de rede (manter comportamento original)
                await new Promise(res => setTimeout(res, 1500));

                // [FACTORY] — Cria objeto de ocorrência padronizado
                const ocorrencia = EntidadeFactory.criarOcorrencia({
                    nome:        document.getElementById('denuncia-nome')?.value || 'Anônimo',
                    localizacao: document.getElementById('denuncia-local')?.value || '',
                    tipo:        document.getElementById('denuncia-tipo')?.value  || 'Agressão Física',
                    relato:      document.getElementById('denuncia-relato')?.value || '',
                });

                // [SINGLETON] — Persiste no localStorage via instância única
                db.adicionarOcorrencia(ocorrencia);

                // [OBSERVER] — Notifica observadores sobre nova ocorrência
                GerenciadorEventos.notificar('nova_ocorrencia', ocorrencia);

                // Exibe confirmação visual (mantido do original)
                Swal.fire({
                    title:              'PROTOCOLO GERADO!',
                    html:               `Denúncia enviada ao Comando!<br><br>
                                         <strong style="color:#c5a666; font-size:1.2rem;">
                                           Protocolo: ${ocorrencia.protocolo}
                                         </strong>`,
                    icon:               'success',
                    confirmButtonColor: '#c5a666',
                });

                formDenuncia.reset();
                checkAllForms();

            } catch (err) {
                Swal.fire('Erro', 'Não foi possível enviar a denúncia.', 'error');
                console.error('[App] Erro ao enviar denúncia:', err);
            } finally {
                btn.innerHTML = textoOriginal;
                btn.disabled  = false;
            }
        });
    }

    // ---------------------------------------------------------
    //  5b. FORMULÁRIO DE CADASTRO (CRIAR CONTA)
    //  [FACTORY]   → criarUsuario() cria o objeto padronizado
    //  [SINGLETON] → db.adicionarUsuario() salva no localStorage
    //  [OBSERVER]  → notificar('novo_usuario') dispara o toast
    // ---------------------------------------------------------
    const formReg = document.getElementById('form-reg');
    if (formReg) {
        formReg.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn           = formReg.querySelector('button[type="submit"]');
            const textoOriginal  = btn.innerHTML;

            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ENVIANDO...';
            btn.disabled  = true;

            try {
                await new Promise(res => setTimeout(res, 1500));

                const inputs = formReg.querySelectorAll('input, select');

                // [FACTORY] — Cria usuário com estrutura padronizada
                const usuario = EntidadeFactory.criarUsuario({
                    nome:          inputs[0]?.value || '',
                    sobrenome:     inputs[1]?.value || '',
                    cpf:           inputs[2]?.value || '',
                    email:         inputs[3]?.value || '',
                    especialidade: formReg.querySelector('select')?.value || '',
                    senha:         inputs[5]?.value || '',
                });

                // [SINGLETON] — Persiste o usuário no localStorage
                db.adicionarUsuario(usuario);

                // [OBSERVER] — Notifica sobre novo usuário
                GerenciadorEventos.notificar('novo_usuario', usuario);

                Swal.fire({
                    title:              'CONTA CRIADA!',
                    text:               'Sua conta foi criada com sucesso!',
                    icon:               'success',
                    confirmButtonColor: '#c5a666',
                });

                formReg.reset();
                toggleAuth(false);

            } catch (err) {
                Swal.fire('Erro', 'Não foi possível criar a conta.', 'error');
                console.error('[App] Erro ao cadastrar usuário:', err);
            } finally {
                btn.innerHTML = textoOriginal;
                btn.disabled  = false;
            }
        });
    }

    // ---------------------------------------------------------
    //  5c. FORMULÁRIO DE LOGIN
    //  [SINGLETON] → busca usuário no localStorage para validação
    // ---------------------------------------------------------
    const formLogin = document.getElementById('form-login');
    if (formLogin) {
        formLogin.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn           = formLogin.querySelector('button[type="submit"]');
            const textoOriginal  = btn.innerHTML;

            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> VERIFICANDO...';
            btn.disabled  = true;

            try {
                await new Promise(res => setTimeout(res, 1200));

                // [SINGLETON] — Consulta usuários no banco de dados único
                const emailDigitado = formLogin.querySelector('input[type="email"]')?.value || '';
                const usuarioEncontrado = db.buscarUsuarioPorEmail(emailDigitado);

                if (usuarioEncontrado) {
                    GerenciadorEventos.exibirToast(
                        '🎖️ Acesso Concedido',
                        `Bem-vindo(a) de volta, <strong>${usuarioEncontrado.nome}</strong>!`,
                        'sucesso'
                    );
                    toggleAuth(false);
                } else {
                    // Fallback: simula login (para não quebrar o fluxo se não há cadastro)
                    Swal.fire({
                        title:              'ACESSO CONCEDIDO',
                        text:               'Login realizado!',
                        icon:               'success',
                        confirmButtonColor: '#c5a666',
                    });
                    toggleAuth(false);
                }

                formLogin.reset();

            } catch (err) {
                Swal.fire('Erro', 'Não foi possível realizar o login.', 'error');
            } finally {
                btn.innerHTML = textoOriginal;
                btn.disabled  = false;
            }
        });
    }

    // ---------------------------------------------------------
    //  5d. FORMULÁRIO DE ADOÇÃO (PRONTUÁRIO)
    //  [FACTORY]   → criarAgendamento() cria o objeto padronizado
    //  [SINGLETON] → db.adicionarAgendamento() salva no localStorage
    //  [OBSERVER]  → notificar('novo_agendamento') dispara o toast
    // ---------------------------------------------------------
    const formAdopt = document.getElementById('form-adopt');
    if (formAdopt) {
        formAdopt.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn           = formAdopt.querySelector('button[type="submit"]');
            const textoOriginal  = btn.innerHTML;

            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ENVIANDO...';
            btn.disabled  = true;

            try {
                await new Promise(res => setTimeout(res, 1500));

                const modal    = document.getElementById('adopt-modal');
                const petNome  = modal?.dataset.petName || 'Animal';

                // [FACTORY] — Cria agendamento com estrutura padronizada
                const agendamento = EntidadeFactory.criarAgendamento({
                    nomeAdotante: formAdopt.querySelector('input[type="text"]')?.value || '',
                    telefone:     document.getElementById('adopt-phone')?.value       || '',
                    residencia:   formAdopt.querySelector('select')?.value            || '',
                    motivacao:    formAdopt.querySelector('textarea')?.value          || '',
                    petNome,
                });

                // [SINGLETON] — Persiste agendamento
                db.adicionarAgendamento(agendamento);

                // [OBSERVER] — Notifica sobre novo agendamento
                GerenciadorEventos.notificar('novo_agendamento', agendamento);

                Swal.fire({
                    title:              'SOLICITAÇÃO ENVIADA!',
                    html:               `Prontuário de <strong>${petNome}</strong> solicitado!<br>
                                         Protocolo: <strong style="color:#c5a666">${agendamento.protocolo}</strong>`,
                    icon:               'success',
                    confirmButtonColor: '#c5a666',
                });

                formAdopt.reset();
                toggleAdopt(false);

            } catch (err) {
                Swal.fire('Erro', 'Não foi possível enviar a solicitação.', 'error');
                console.error('[App] Erro ao solicitar prontuário:', err);
            } finally {
                btn.innerHTML = textoOriginal;
                btn.disabled  = false;
            }
        });
    }

    // =========================================================
    //  6. DEMO DO OBSERVER — Botão de teste de mudança de status
    //  Simula a atualização de status de ocorrências para
    //  demonstrar o padrão Observer em ação.
    // =========================================================
    const btnDemoStatus = document.getElementById('btn-demo-status');
    if (btnDemoStatus) {
        const statusSequencia = [
            'Em Análise',
            'Equipe Acionada',
            'Resgatado',
            'Encaminhado para Adoção',
        ];
        let demoIndex = 0;

        btnDemoStatus.addEventListener('click', () => {
            const ocorrencias = db.getOcorrencias();

            if (ocorrencias.length === 0) {
                // [OBSERVER] — toast de aviso quando não há ocorrências
                GerenciadorEventos.exibirToast(
                    '⚠️ Nenhuma Ocorrência',
                    'Envie uma denúncia primeiro para ver o Observer em ação!',
                    'alerta'
                );
                return;
            }

            // Pega a última ocorrência registrada
            const ultima      = ocorrencias[ocorrencias.length - 1];
            const novoStatus  = statusSequencia[demoIndex % statusSequencia.length];
            demoIndex++;

            // [SINGLETON] → atualiza status → [OBSERVER] dispara notificação
            db.atualizarStatusOcorrencia(ultima.id, novoStatus);
        });
    }

    // =========================================================
    //  7. CARREGAR STATUS DE OCORRÊNCIAS EXISTENTES
    //  Exibe na área de status as ocorrências já registradas
    // =========================================================
    const areaStatus = document.getElementById('area-status-ocorrencias');
    if (areaStatus) {
        const ocorrencias = db.getOcorrencias();
        // Exibe as 3 mais recentes
        ocorrencias.slice(-3).reverse().forEach(oc => {
            GerenciadorEventos._atualizarAreaStatus(oc);
        });
    }

});