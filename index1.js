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

    // =========================================================
    //  8. CONTADOR ANIMADO DE IMPACTO
    // =========================================================
    const contadores = document.querySelectorAll('.stat-number');
    if (contadores.length) {
        const animarContador = (el) => {
            const alvo = parseInt(el.dataset.target, 10);
            const duracao = 2000;
            const passo = Math.ceil(alvo / (duracao / 16));
            let atual = 0;
            const timer = setInterval(() => {
                atual = Math.min(atual + passo, alvo);
                el.textContent = atual.toLocaleString('pt-BR');
                if (atual >= alvo) clearInterval(timer);
            }, 16);
        };
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(e => {
                if (e.isIntersecting) {
                    animarContador(e.target);
                    observer.unobserve(e.target);
                }
            });
        }, { threshold: 0.5 });
        contadores.forEach(el => observer.observe(el));
    }

    // =========================================================
    //  9. FILTRO DE ADOÇÃO
    // =========================================================
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const filtro = btn.dataset.filter;
            document.querySelectorAll('#pet-grid .pet-card').forEach(card => {
                if (filtro === 'all') {
                    card.classList.remove('hidden');
                } else if (filtro === 'cachorro' || filtro === 'gato') {
                    card.classList.toggle('hidden', card.dataset.especie !== filtro);
                } else {
                    card.classList.toggle('hidden', card.dataset.tamanho !== filtro);
                }
            });
        });
    });

    // =========================================================
    //  10. MÁSCARA TELEFONE VOLUNTÁRIO
    // =========================================================
    const elVolPhone = document.getElementById('voluntario-phone');
    if (elVolPhone) IMask(elVolPhone, { mask: '(00) 00000-0000' });

    // =========================================================
    //  11. FORMULÁRIO DE VOLUNTARIADO
    // =========================================================
    const formVol = document.getElementById('form-voluntario');
    if (formVol) {
        formVol.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = formVol.querySelector('button[type="submit"]');
            const orig = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ENVIANDO...';
            btn.disabled = true;
            await new Promise(r => setTimeout(r, 1200));
            Swal.fire({
                title: 'CADASTRO RECEBIDO!',
                html: 'Obrigado por querer fazer parte do Guard Pets!<br>Nossa equipe entrará em contato em breve.',
                icon: 'success',
                confirmButtonColor: '#c5a666',
            });
            formVol.reset();
            btn.innerHTML = orig;
            btn.disabled = false;
        });
    }

    // =========================================================
    //  12. RASTREAMENTO DE PROTOCOLO
    // =========================================================
    window.rastrearProtocolo = () => {
        const input = document.getElementById('input-protocolo');
        const resultado = document.getElementById('resultado-rastreamento');
        if (!input || !resultado) return;

        const protocolo = input.value.trim().toUpperCase();
        if (!protocolo || protocolo.length < 5) {
            Swal.fire('Atenção', 'Digite um protocolo válido (ex: GP-123456)', 'warning');
            return;
        }

        const ocorrencias = BancoDeDados.getInstance().getOcorrencias();
        const oc = ocorrencias.find(o => o.protocolo === protocolo);

        resultado.style.display = 'block';

        const statusLabels = {
            'Registrado': { cor: 'rgba(255,255,255,0.2)', texto: '📋 Registrado — aguardando triagem' },
            'Em Análise': { cor: '#3498db', texto: '🔍 Em Análise — equipe avaliando' },
            'Equipe Acionada': { cor: '#f39c12', texto: '🚨 Equipe Acionada — resgate em andamento' },
            'Resgatado': { cor: '#27ae60', texto: '✅ Animal Resgatado com sucesso!' },
            'Encaminhado para Adoção': { cor: '#c5a666', texto: '🏠 Encaminhado para Adoção' },
        };

        if (!oc) {
            resultado.innerHTML = `
                <p class="resultado-protocolo">PROTOCOLO: ${protocolo}</p>
                <p style="color:#e74c3c; font-weight:700;">Protocolo não encontrado.</p>
                <p style="font-size:0.8rem; opacity:0.6; margin-top:8px;">Verifique o número e tente novamente.</p>
            `;
            return;
        }

        const info = statusLabels[oc.status] || { cor: '#fff', texto: oc.status };
        resultado.innerHTML = `
            <p class="resultado-protocolo">PROTOCOLO: ${oc.protocolo}</p>
            <p class="resultado-tipo">${oc.tipo}</p>
            <p class="resultado-local"><i class="fas fa-map-marker-alt"></i> ${oc.localizacao}</p>
            <div style="background:${info.cor}22; border:1px solid ${info.cor}55; border-radius:10px; padding:12px 18px; display:inline-block;">
                <span style="font-weight:700; color:${info.cor}; font-size:0.9rem;">${info.texto}</span>
            </div>
            <p style="font-size:0.7rem; opacity:0.4; margin-top:15px;">Registrado em: ${new Date(oc.criadoEm || oc.id).toLocaleDateString('pt-BR')}</p>
        `;
    };

    // =========================================================
    //  13. MAPA DE OCORRÊNCIAS (Leaflet.js)
    // =========================================================
    const mapaEl = document.getElementById('mapa-leaflet');
    if (mapaEl && window.L) {
        const mapa = L.map('mapa-leaflet', { zoomControl: true }).setView([-22.4634, -44.4500], 12);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OpenStreetMap &copy; CARTO',
            maxZoom: 18,
        }).addTo(mapa);

        const icone = L.divIcon({
            html: '<div style="background:#e74c3c; width:14px; height:14px; border-radius:50%; border:3px solid #fff; box-shadow:0 0 8px rgba(231,76,60,0.8);"></div>',
            className: '',
            iconSize: [14, 14],
        });

        // Marcadores de demonstração
        const pontos = [
            { lat: -22.4634, lng: -44.4500, tipo: 'Agressão Física', bairro: 'Centro, Resende' },
            { lat: -22.4780, lng: -44.4620, tipo: 'Abandono', bairro: 'Jardim Primavera, Resende' },
            { lat: -22.4510, lng: -44.4380, tipo: 'Envenenamento', bairro: 'Vila Isabel, Resende' },
            { lat: -22.5120, lng: -44.1050, tipo: 'Abandono', bairro: 'Volta Redonda' },
            { lat: -22.4020, lng: -44.5680, tipo: 'Agressão Física', bairro: 'Itatiaia' },
        ];

        // Adicionar ocorrências reais do localStorage
        const ocorrs = BancoDeDados.getInstance().getOcorrencias();

        pontos.forEach(p => {
            L.marker([p.lat, p.lng], { icon: icone })
                .addTo(mapa)
                .bindPopup(`<b style="color:#e74c3c">${p.tipo}</b><br><small>${p.bairro}</small>`);
        });
    }

});

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
    window.toggleMenu = () => {
        const nav = document.getElementById('nav-menu');
        const btn = document.getElementById('hamburger-btn');
        if (!nav) return;
        const open = nav.classList.toggle('open');
        btn.innerHTML = open ? '<i class="fas fa-times"></i>' : '<i class="fas fa-bars"></i>';
    };

    // Fecha o menu ao clicar em um link
    document.querySelectorAll('#nav-menu a').forEach(link => {
        link.addEventListener('click', () => {
            document.getElementById('nav-menu')?.classList.remove('open');
            const btn = document.getElementById('hamburger-btn');
            if (btn) btn.innerHTML = '<i class="fas fa-bars"></i>';
        });
    });

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
                // [FACTORY] — Cria objeto de ocorrência padronizado
                const ocorrencia = EntidadeFactory.criarOcorrencia({
                    nome:        document.getElementById('denuncia-nome')?.value || 'Anônimo',
                    localizacao: document.getElementById('denuncia-local')?.value || '',
                    tipo:        document.getElementById('denuncia-tipo')?.value  || 'Agressão Física',
                    relato:      document.getElementById('denuncia-relato')?.value || '',
                });

                // Envia ao backend (não bloqueia se falhar — salva localmente de qualquer forma)
                try {
                    await fetch('/denuncia', {
                        method:  'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body:    JSON.stringify({
                            nome:        ocorrencia.nome,
                            localizacao: ocorrencia.localizacao,
                            tipo:        ocorrencia.tipo,
                            relato:      ocorrencia.relato,
                        }),
                    });
                } catch (_) { /* backend indisponível, continua offline */ }

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
    //  Envia dados via POST /register → banco Supabase
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
                const nome         = formReg.querySelector('input[name="nome"]')?.value         || '';
                const sobrenome    = formReg.querySelector('input[name="sobrenome"]')?.value    || '';
                const cpf          = formReg.querySelector('input[name="cpf"]')?.value          || '';
                const email        = formReg.querySelector('input[name="email"]')?.value        || '';
                const especialidade = formReg.querySelector('select[name="especialidade"]')?.value || '';
                const senha        = formReg.querySelector('input[name="senha"]')?.value        || '';

                const resp = await fetch('/register', {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify({ nome, sobrenome, cpf, email, especialidade, senha }),
                });
                const data = await resp.json();

                if (!resp.ok) {
                    const msg = resp.status === 503
                        ? 'Banco de dados não conectado. Verifique a configuração do servidor.'
                        : data.error || 'Não foi possível criar a conta.';
                    Swal.fire('Erro no Cadastro', msg, 'error');
                    return;
                }

                // [OBSERVER] — Notifica sobre novo usuário
                GerenciadorEventos.notificar('novo_usuario', { nome, email });

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
    //  Autentica via POST /login → recebe JWT → salva no localStorage
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
                const email = formLogin.querySelector('input[name="email"]')?.value || '';
                const senha = formLogin.querySelector('input[name="senha"]')?.value || '';

                const resp = await fetch('/login', {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify({ email, senha }),
                });
                const data = await resp.json();

                if (!resp.ok) {
                    const msg = resp.status === 503
                        ? 'Banco de dados não conectado. Verifique a configuração do servidor.'
                        : data.error || 'Credenciais inválidas.';
                    Swal.fire('Acesso Negado', msg, 'error');
                    return;
                }

                localStorage.setItem('gp_token',   data.token);
                localStorage.setItem('gp_usuario', JSON.stringify(data.usuario));

                GerenciadorEventos.exibirToast(
                    '🎖️ Acesso Concedido',
                    `Bem-vindo(a) de volta, <strong>${data.usuario.nome}</strong>!`,
                    'sucesso'
                );
                toggleAuth(false);
                formLogin.reset();

            } catch (err) {
                Swal.fire('Erro', 'Não foi possível realizar o login.', 'error');
                console.error('[App] Erro ao fazer login:', err);
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