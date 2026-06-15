// ─── Supabase Auth (chamadas diretas — sem CDN) ───────────────────────────────
const _SUPA_URL = 'https://uwlxknmpsurlyjlrajbr.supabase.co';
const _SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3bHhrbm1wc3VybHlqbHJhamJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5NDM1MzUsImV4cCI6MjA5NjUxOTUzNX0.o_FnYF843XupwK9xx2KTx7IKdj5S1hHJhKoKE0shBAY';

const _supaHeaders = { 'apikey': _SUPA_KEY, 'Content-Type': 'application/json' };

async function supaSignUp(email, password, meta) {
    const r = await fetch(`${_SUPA_URL}/auth/v1/signup`, {
        method: 'POST',
        headers: _supaHeaders,
        body: JSON.stringify({ email, password, data: meta })
    });
    return r.json();
}

async function supaSignIn(email, password) {
    const r = await fetch(`${_SUPA_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: _supaHeaders,
        body: JSON.stringify({ email, password })
    });
    return r.json();
}

async function supaSignOut() {
    const token = localStorage.getItem('gp_supa_token');
    if (!token) return;
    await fetch(`${_SUPA_URL}/auth/v1/logout`, {
        method: 'POST',
        headers: { ..._supaHeaders, 'Authorization': `Bearer ${token}` }
    }).catch(() => {});
    localStorage.removeItem('gp_supa_token');
    localStorage.removeItem('gp_supa_user');
}

async function supaGetUser(token) {
    const r = await fetch(`${_SUPA_URL}/auth/v1/user`, {
        headers: { ..._supaHeaders, 'Authorization': `Bearer ${token}` }
    });
    if (!r.ok) return null;
    return r.json();
}

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
                const nome          = formReg.querySelector('input[name="nome"]')?.value          || '';
                const sobrenome     = formReg.querySelector('input[name="sobrenome"]')?.value     || '';
                const email         = formReg.querySelector('input[name="email"]')?.value         || '';
                const especialidade = formReg.querySelector('select[name="especialidade"]')?.value || 'Agente';
                const senha         = formReg.querySelector('input[name="senha"]')?.value         || '';

                if (!email || !senha) {
                    Swal.fire('Atenção', 'Preencha email e senha.', 'warning');
                    return;
                }

                const data = await supaSignUp(email, senha, { nome, sobrenome, especialidade });

                if (data.error || data.msg) {
                    const msg = data.error?.message || data.msg || 'Erro ao criar conta.';
                    Swal.fire('Erro no Cadastro', msg, 'error');
                    return;
                }

                // [OBSERVER] — Notifica sobre novo usuário
                GerenciadorEventos.notificar('novo_usuario', { nome, email });

                Swal.fire({
                    title:             'CONFIRME SEU EMAIL! 📧',
                    html:              `Enviamos um link de confirmação para <strong>${email}</strong>.<br><br>Verifique sua caixa de entrada (e spam) e clique no link para ativar sua conta.`,
                    icon:              'success',
                    confirmButtonColor: '#c5a666',
                });

                formReg.reset();
                toggleAuth(false);

            } catch (err) {
                Swal.fire('Erro', 'Não foi possível criar a conta. Verifique sua conexão.', 'error');
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

                const data = await supaSignIn(email, senha);

                if (data.error || !data.access_token) {
                    const code = data.error?.message || data.error_description || '';
                    let msg = 'Email ou senha incorretos.';
                    if (code.includes('Email not confirmed') || code.includes('email_not_confirmed'))
                        msg = 'Email ainda não confirmado. Verifique sua caixa de entrada e clique no link de ativação.';
                    Swal.fire('Acesso Negado', msg, 'error');
                    return;
                }

                localStorage.setItem('gp_supa_token', data.access_token);
                const user = data.user || {};
                mostrarPerfilAgente(user);

                GerenciadorEventos.exibirToast('🎖️ Acesso Concedido', 'Bem-vindo(a) de volta!', 'sucesso');
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



    // =========================================================
    //  PAINEL DO AGENTE
    // =========================================================

    // ── Checar sessão salva ao carregar ──────────────────────────────────────
    (async () => {
        // Verifica se voltou de um link de confirmação de email
        const hash = window.location.hash;
        if (hash && hash.includes('access_token')) {
            const params = new URLSearchParams(hash.substring(1));
            const token  = params.get('access_token');
            const type   = params.get('type');
            if (token && (type === 'signup' || type === 'magiclink')) {
                localStorage.setItem('gp_supa_token', token);
                history.replaceState(null, '', window.location.pathname);
                const user = await supaGetUser(token);
                if (user && user.id) {
                    mostrarPerfilAgente(user);
                    Swal.fire({ title: 'Email confirmado!', text: 'Bem-vindo(a) ao GuardPets!', icon: 'success', confirmButtonColor: '#c5a666', timer: 3000, showConfirmButton: false });
                    return;
                }
            }
        }
        // Verifica token salvo
        const token = localStorage.getItem('gp_supa_token');
        if (token) {
            const user = await supaGetUser(token);
            if (user && user.id) mostrarPerfilAgente(user);
            else { localStorage.removeItem('gp_supa_token'); localStorage.removeItem('gp_supa_user'); }
        }
    })();

    function _iniciais(nome) {
        return (nome || '?').split(' ').map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
    }

    function mostrarPerfilAgente(user) {
        const meta     = user.user_metadata || {};
        const nome     = meta.nome ? `${meta.nome} ${meta.sobrenome || ''}`.trim() : (user.email || '').split('@')[0];
        const iniciais = _iniciais(nome);

        const wrapper  = document.getElementById('perfil-dropdown-wrapper');
        const authBtns = document.getElementById('nav-auth-buttons');
        if (wrapper)  wrapper.style.display  = 'flex';
        if (authBtns) authBtns.style.display = 'none';

        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        set('nav-agente-nome',   nome);
        set('perfil-avatar-mini', iniciais);
        set('pd-avatar', iniciais);
        set('pd-nome',   nome);
        set('pd-email',  user.email);
        set('pd-role',   meta.especialidade || 'Agente');

        localStorage.setItem('gp_usuario',    JSON.stringify({ id: user.id, nome, email: user.email }));
        localStorage.setItem('gp_supa_user',  JSON.stringify(user));
    }

    function esconderPerfilAgente() {
        const wrapper   = document.getElementById('perfil-dropdown-wrapper');
        const authBtns  = document.getElementById('nav-auth-buttons');
        if (wrapper)  wrapper.style.display  = 'none';
        if (authBtns) authBtns.style.display = '';
        ['gp_usuario', 'gp_token', 'gp_supa_token', 'gp_supa_user'].forEach(k => localStorage.removeItem(k));
    }

    window.abrirMeuPerfil = () => {
        const user = JSON.parse(localStorage.getItem('gp_supa_user') || localStorage.getItem('gp_usuario') || 'null');
        if (!user) return;

        const meta     = user.user_metadata || {};
        const nome     = meta.nome ? `${meta.nome} ${meta.sobrenome || ''}`.trim() : (user.email || '').split('@')[0];
        const iniciais = _iniciais(nome);
        const desde    = user.created_at
            ? new Date(user.created_at).toLocaleDateString('pt-BR', { day:'2-digit', month:'long', year:'numeric' })
            : new Date().toLocaleDateString('pt-BR', { day:'2-digit', month:'long', year:'numeric' });

        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        set('pm-avatar',       iniciais);
        set('pm-badge',        meta.especialidade || 'Agente');
        set('pm-nome',         nome);
        set('pm-email',        user.email || '');
        set('pm-especialidade', meta.especialidade || 'Agente');
        set('pm-desde',        desde);
        set('pm-email2',       user.email || '');

        const modal = document.getElementById('perfil-modal');
        if (modal) { modal.style.display = 'flex'; modal.style.opacity = '1'; modal.style.pointerEvents = 'all'; modal.classList.add('active'); }
        document.body.style.overflow = 'hidden';
    };

    window.fecharMeuPerfil = () => {
        const modal = document.getElementById('perfil-modal');
        if (modal) { modal.classList.remove('active'); modal.style.display = 'none'; }
        document.body.style.overflow = 'auto';
    };

    window.togglePerfilDropdown = (forceClose) => {
        const dropdown = document.getElementById('perfil-dropdown');
        const overlay  = document.getElementById('pd-overlay');
        if (!dropdown) return;
        const aberto    = dropdown.style.display !== 'none';
        const fechar    = forceClose === false || aberto;
        dropdown.style.display = fechar ? 'none' : 'block';
        if (overlay) overlay.style.display = fechar ? 'none' : 'block';
    };

    window.fazerLogout = async () => {
        await supaSignOut();
        togglePerfilDropdown(false);
        esconderPerfilAgente();
        GerenciadorEventos.exibirToast('Até logo!', 'Sessão encerrada com sucesso.', 'info');
    };

    window.abrirPainel = () => {
        const usuario = JSON.parse(localStorage.getItem('gp_usuario') || 'null');
        if (!usuario) { toggleAuth(true); return; }

        const el = document.getElementById('painel-modal');
        const nomeEl = document.getElementById('painel-agente-nome');
        if (nomeEl) nomeEl.textContent = usuario.email + ' — ' + (usuario.tipo || 'Agente');
        if (el) el.classList.add('active');
        document.body.style.overflow = 'hidden';
        carregarPainel();
    };

    window.fecharPainel = () => {
        const el = document.getElementById('painel-modal');
        if (el) el.classList.remove('active');
        document.body.style.overflow = 'auto';
    };

    window.trocarAbaPainel = (aba, btn) => {
        document.querySelectorAll('.painel-aba').forEach(a => a.style.display = 'none');
        document.querySelectorAll('.painel-tab').forEach(b => b.classList.remove('active'));
        const el = document.getElementById('aba-' + aba);
        if (el) el.style.display = 'block';
        if (btn) btn.classList.add('active');
        if (aba === 'stats') carregarStats();
    };

    function carregarPainel() {
        carregarDenuncias();
        carregarAdocoes();
    }

    async function carregarDenuncias() {
        const lista = document.getElementById('lista-denuncias');
        const badge = document.getElementById('badge-denuncias');
        if (!lista) return;

        lista.innerHTML = '<div class="painel-vazio"><i class="fas fa-spinner fa-spin"></i> Carregando...</div>';

        let ocorrencias = [];
        const token = localStorage.getItem('gp_supa_token');

        try {
            const resp = await fetch('/ocorrencias', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (resp.ok) {
                ocorrencias = await resp.json();
            } else {
                // fallback para localStorage se banco não configurado
                ocorrencias = db.getOcorrencias().reverse();
            }
        } catch (_) {
            ocorrencias = db.getOcorrencias().reverse();
        }

        if (badge) badge.textContent = ocorrencias.length;

        if (ocorrencias.length === 0) {
            lista.innerHTML = '<div class="painel-vazio"><i class="fas fa-satellite-dish"></i>Nenhuma denúncia registrada ainda.</div>';
            return;
        }

        lista.innerHTML = ocorrencias.map((oc, i) => {
            const statusOpts = ['Registrado','Em Análise','Equipe Acionada','Resgatado','Encaminhado para Adoção']
                .map(s => `<option value="${s}" ${oc.status === s ? 'selected' : ''}>${s}</option>`).join('');
            return `
            <div class="painel-denuncia-card">
                <div class="pdc-header">
                    <div>
                        <div class="pdc-protocolo">${oc.protocolo || 'SEM PROTOCOLO'}</div>
                        <div class="pdc-tipo">${oc.tipo}</div>
                        <div class="pdc-local"><i class="fas fa-map-marker-alt"></i> ${oc.localizacao}</div>
                        <div class="pdc-nome">Denunciante: ${oc.nome_denunciante || oc.nome || 'Anônimo'}</div>
                    </div>
                </div>
                <div class="pdc-relato">${oc.relato}</div>
                <div class="pdc-footer">
                    <select class="pdc-status-select" id="status-sel-${i}">${statusOpts}</select>
                    <button class="pdc-btn-atualizar" onclick="atualizarStatus('${oc.id}', 'status-sel-${i}')">
                        <i class="fas fa-save"></i> ATUALIZAR STATUS
                    </button>
                </div>
            </div>`;
        }).join('');
    }

    function carregarAdocoes() {
        const lista = document.getElementById('lista-adocoes');
        const badge = document.getElementById('badge-adocoes');
        if (!lista) return;

        const agendamentos = db.getAgendamentos().reverse();
        if (badge) badge.textContent = agendamentos.length;

        if (agendamentos.length === 0) {
            lista.innerHTML = '<div class="painel-vazio"><i class="fas fa-paw"></i>Nenhuma solicitação de adoção ainda.</div>';
            return;
        }

        lista.innerHTML = agendamentos.map(ag => `
            <div class="painel-adocao-card">
                <div>
                    <div class="pac-pet">🐾 ${ag.petNome || 'Animal'}</div>
                    <div class="pac-adotante">${ag.nomeAdotante}</div>
                    <div class="pac-tel"><i class="fas fa-phone"></i> ${ag.telefone}</div>
                    <div class="pac-residencia"><i class="fas fa-home"></i> ${ag.residencia}</div>
                    <div class="pac-protocolo">${ag.protocolo || ''}</div>
                </div>
                <div style="font-size:0.75rem; color:rgba(255,255,255,0.3); max-width:220px; line-height:1.5;">
                    <b style="color:rgba(255,255,255,0.5);">Motivação:</b><br>${ag.motivacao || '—'}
                </div>
            </div>
        `).join('');
    }

    function carregarStats() {
        const ocs = db.getOcorrencias();
        const ags = db.getAgendamentos();
        const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        setEl('ps-total',    ocs.length);
        setEl('ps-analise',  ocs.filter(o => o.status === 'Em Análise' || o.status === 'Equipe Acionada').length);
        setEl('ps-resgatado',ocs.filter(o => o.status === 'Resgatado').length);
        setEl('ps-adocoes',  ags.length);
    }

    window.atualizarStatus = async (id, selectId) => {
        const sel = document.getElementById(selectId);
        if (!sel) return;
        const novoStatus = sel.value;
        const token = localStorage.getItem('gp_supa_token');

        try {
            await fetch(`/ocorrencias/${id}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ status: novoStatus })
            });
        } catch (_) {}

        db.atualizarStatusOcorrencia(id, novoStatus);
        GerenciadorEventos.exibirToast('✅ Status Atualizado', `Ocorrência marcada como: <strong>${novoStatus}</strong>`, 'sucesso');
    };

    // Fechar painel clicando fora
    document.getElementById('painel-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'painel-modal') fecharPainel();
    });



    // =========================================================
    //  BOTÃO VOLTAR AO TOPO
    // =========================================================
    const btnTopo = document.getElementById('btn-topo');
    if (btnTopo) {
        window.addEventListener('scroll', () => {
            btnTopo.classList.toggle('visible', window.scrollY > 400);
        });
        btnTopo.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    }

    // =========================================================
    //  FAVORITAR PET
    // =========================================================
    let favoritos = JSON.parse(localStorage.getItem('gp_favoritos') || '[]');

    window.toggleFavorito = (nome, btn) => {
        const idx = favoritos.indexOf(nome);
        if (idx === -1) {
            favoritos.push(nome);
            btn.classList.add('favoritado');
            GerenciadorEventos.exibirToast('❤️ Favoritado!', `<strong>${nome}</strong> adicionado aos seus favoritos.`, 'sucesso');
        } else {
            favoritos.splice(idx, 1);
            btn.classList.remove('favoritado');
            GerenciadorEventos.exibirToast('💔 Removido', `<strong>${nome}</strong> removido dos favoritos.`, 'alerta');
        }
        localStorage.setItem('gp_favoritos', JSON.stringify(favoritos));
    };

    // Adicionar botão de favorito em cada card
    document.querySelectorAll('#pet-grid .pet-card').forEach(card => {
        const info = card.querySelector('.pet-info');
        const h3   = info?.querySelector('h3');
        if (!h3) return;
        const nome = h3.textContent.split('(')[0].trim();
        const btn  = document.createElement('button');
        btn.className  = 'btn-favorito' + (favoritos.includes(nome) ? ' favoritado' : '');
        btn.title      = 'Favoritar';
        btn.innerHTML  = '<i class="fas fa-heart"></i>';
        btn.onclick    = () => toggleFavorito(nome, btn);
        card.appendChild(btn);
    });

    // =========================================================
    //  LOADING SCREEN
    // =========================================================
    window.addEventListener('load', () => {
        const loader = document.getElementById('loading-screen');
        if (loader) {
            setTimeout(() => loader.classList.add('oculto'), 600);
            setTimeout(() => loader.remove(), 1200);
        }
    });

    // =========================================================
    //  BUSCA NO PAINEL (sobrescreve carregarDenuncias com filtro)
    // =========================================================
    window.buscarNoPainel = () => {
        const termo = document.getElementById('painel-busca')?.value.toLowerCase() || '';
        document.querySelectorAll('.painel-denuncia-card').forEach(card => {
            const texto = card.textContent.toLowerCase();
            card.style.display = texto.includes(termo) ? '' : 'none';
        });
    };




    // =========================================================
    //  PIX — Copiar chave
    // =========================================================
    window.copiarChavePix = () => {
        navigator.clipboard.writeText('guardpets@resende.org').then(() => {
            GerenciadorEventos.exibirToast('✅ Copiado!', 'Chave PIX copiada para a área de transferência.', 'sucesso');
        });
    };

    window.copiarPix = (valor) => {
        navigator.clipboard.writeText('guardpets@resende.org').then(() => {
            Swal.fire({
                title: 'Obrigado! 🐾',
                html: `Chave PIX copiada!<br><br>Valor sugerido: <strong style="color:#c5a666">${valor}</strong><br><small style="opacity:0.6">Abra o app do banco e cole a chave PIX.</small>`,
                icon: 'success', confirmButtonColor: '#c5a666',
            });
        });
    };



});