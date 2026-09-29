// ─── Supabase Auth (chamadas diretas — sem CDN) ───────────────────────────────
// URL/key vêm de js/patterns/supabaseClient.js (carrega antes deste arquivo) —
// fonte única, pra não ter a chave duplicada em dois arquivos.
const _SUPA_URL = window.SUPABASE_URL;
const _SUPA_KEY = window.SUPABASE_ANON_KEY;

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

    // Escapa texto vindo de usuário antes de jogar em innerHTML — animais,
    // denúncias e solicitações de adoção são todos texto livre digitado por
    // alguém e exibidos pra outras pessoas (inclusive o admin no painel).
    function escapeHTML(str) {
        return String(str ?? '').replace(/[&<>"']/g, (c) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
        }[c]));
    }

    // =========================================================
    //  1. CONFIGURAÇÕES INICIAIS
    // =========================================================
    AOS.init({ duration: 900, once: true, easing: 'ease-out', offset: 60 });

    // Header glassmorphism no scroll
    const header = document.querySelector('header');
    let lastScroll = 0;
    window.addEventListener('scroll', () => {
        const y = window.scrollY;
        if (header) header.classList.toggle('scrolled', y > 50);
        // Esconde header ao rolar pra baixo rápido, mostra ao subir
        if (y > 200 && y > lastScroll + 10) header?.classList.add('header-hidden');
        else if (y < lastScroll - 5) header?.classList.remove('header-hidden');
        lastScroll = y;
    }, { passive: true });

    // Lazy load gracioso nas imagens
    document.querySelectorAll('img').forEach(img => {
        if (img.complete) { img.classList.add('loaded'); return; }
        img.addEventListener('load', () => img.classList.add('loaded'));
        if (!img.classList.contains('hero-bg') && !img.closest('.hero-section'))
            img.setAttribute('loading', 'lazy');
    });

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
    //  8b. ANIMAIS — carregados da API real (GET /animais).
    //  Se a API não responder (banco não configurado), os cards
    //  estáticos que já estão no HTML permanecem como estão.
    // =========================================================
    const SITUACAO_TAG_STYLE = {
        'Resgatado':     'background:#e67e22;',
        'Em Tratamento': 'background:#e67e22;',
        'Urgente':       'background:var(--danger);',
        'Reabilitado':   '',
    };

    const normalizarFiltro = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

    function cardAnimalHTML(a) {
        const adotado  = a.status === 'adotado';
        const btnStyle = adotado ? 'padding:12px;opacity:.5;cursor:not-allowed;' : 'padding:12px;';
        const nome        = escapeHTML(a.nome || 'Sem nome');
        const nomeAtributo = nome.replace(/"/g, '&quot;').replace(/'/g, "\\'");
        const btnAttrs = adotado ? 'disabled' : `onclick="toggleAdopt(true,${Number(a.id)},'${nomeAtributo}')"`;
        const btnLabel = adotado ? 'JÁ ADOTADO' : 'SOLICITAR ADOÇÃO';

        return `
            <div class="pet-card" data-especie="${normalizarFiltro(a.especie)}" data-tamanho="${normalizarFiltro(a.porte)}" data-aos="fade-up">
                <div class="pet-tag" style="${SITUACAO_TAG_STYLE[a.situacao] ?? ''}">${escapeHTML((a.situacao || 'Resgatado').toUpperCase())}</div>
                <img src="${escapeHTML(a.foto_url || '/image/ICON.png')}" class="pet-img" alt="${nome}">
                <div class="pet-info">
                    <h3>${nome} <span style="color:#999; font-size:0.8rem; font-weight:400;">(${escapeHTML(a.raca || 'SRD')})</span></h3>
                    <p style="color:#666; font-size:0.85rem; margin:10px 0 20px;">${escapeHTML(a.descricao || '')}</p>
                    <button class="btn-full" style="${btnStyle}" ${btnAttrs}>${btnLabel}</button>
                </div>
            </div>`;
    }

    async function carregarAnimais() {
        try {
            const resp = await fetch('/animais');
            if (!resp.ok) return;
            const animais = await resp.json();
            if (!Array.isArray(animais) || !animais.length) return;

            const grid = document.getElementById('pet-grid');
            if (grid) grid.innerHTML = animais.map(cardAnimalHTML).join('');

            const totalBtn = document.querySelector('.filter-btn[data-filter="all"]');
            if (totalBtn) totalBtn.textContent = `Todos (${animais.length})`;
        } catch (_) { /* API indisponível — mantém os cards estáticos do HTML */ }
    }
    carregarAnimais();

    // =========================================================
    //  8c. ALERTAS EM TEMPO REAL — Supabase Realtime
    //  [OBSERVER] → quando um animal é cadastrado/atualizado no
    //  banco (por qualquer pessoa, em qualquer aba), todo mundo
    //  vendo o site recebe o toast e a vitrine se atualiza sozinha.
    // =========================================================
    if (window.supabaseClient) {
        window.supabaseClient
            .channel('guardpets-animais')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'animais' }, (payload) => {
                GerenciadorEventos.notificar('novo_animal', payload.new);
                GerenciadorEventos.exibirToast('🐾 Novo Resgate!', `${payload.new.nome} acabou de entrar pra adoção.`, 'sucesso');
                carregarAnimais();
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'animais' }, (payload) => {
                if (payload.new.status !== payload.old.status) carregarAnimais();
            })
            .subscribe();
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

            try {
                const payload = {
                    nome:     formVol.querySelector('[name="nome"]')?.value || '',
                    telefone: formVol.querySelector('[name="telefone"]')?.value || '',
                    tipo:     formVol.querySelector('[name="tipo"]')?.value || 'Outro',
                    cidade:   formVol.querySelector('[name="cidade"]')?.value || '',
                    mensagem: formVol.querySelector('[name="mensagem"]')?.value || '',
                };

                const resp = await fetch('/voluntarios', {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify(payload),
                });
                const data = await resp.json();
                if (!resp.ok) throw new Error(data.error || 'Não foi possível enviar o cadastro.');

                Swal.fire({
                    title: 'CADASTRO RECEBIDO!',
                    html: 'Obrigado por querer fazer parte do Guard Pets!<br>Nossa equipe entrará em contato em breve.',
                    icon: 'success',
                    confirmButtonColor: '#c5a666',
                });
                formVol.reset();
            } catch (err) {
                Swal.fire('Erro', err.message || 'Não foi possível enviar o cadastro.', 'error');
            } finally {
                btn.innerHTML = orig;
                btn.disabled = false;
            }
        });
    }

    // =========================================================
    //  12. RASTREAMENTO DE PROTOCOLO
    //  Consulta o banco de verdade (GET /ocorrencias/protocolo/:protocolo,
    //  pública) — antes só olhava o localStorage do próprio navegador,
    //  então não funcionava se a denúncia tivesse sido feita em outro
    //  aparelho ou depois de limpar o cache.
    // =========================================================
    window.rastrearProtocolo = async () => {
        const input = document.getElementById('input-protocolo');
        const resultado = document.getElementById('resultado-rastreamento');
        if (!input || !resultado) return;

        const protocolo = input.value.trim().toUpperCase();
        if (!protocolo || protocolo.length < 5) {
            Swal.fire('Atenção', 'Digite um protocolo válido (ex: GP-123456)', 'warning');
            return;
        }

        resultado.style.display = 'block';
        resultado.innerHTML = '<p style="opacity:0.6;"><i class="fas fa-spinner fa-spin"></i> Consultando...</p>';

        const statusLabels = {
            'Registrado': { cor: 'rgba(255,255,255,0.2)', texto: '📋 Registrado — aguardando triagem' },
            'Em Análise': { cor: '#3498db', texto: '🔍 Em Análise — equipe avaliando' },
            'Equipe Acionada': { cor: '#f39c12', texto: '🚨 Equipe Acionada — resgate em andamento' },
            'Resgatado': { cor: '#27ae60', texto: '✅ Animal Resgatado com sucesso!' },
            'Encaminhado para Adoção': { cor: '#c5a666', texto: '🏠 Encaminhado para Adoção' },
        };

        let oc = null;
        try {
            const resp = await fetch(`/ocorrencias/protocolo/${encodeURIComponent(protocolo)}`);
            if (resp.ok) oc = await resp.json();
        } catch (_) { /* segue com oc = null */ }

        if (!oc) {
            resultado.innerHTML = `
                <p class="resultado-protocolo">PROTOCOLO: ${escapeHTML(protocolo)}</p>
                <p style="color:#e74c3c; font-weight:700;">Protocolo não encontrado.</p>
                <p style="font-size:0.8rem; opacity:0.6; margin-top:8px;">Verifique o número e tente novamente.</p>
            `;
            return;
        }

        const info = statusLabels[oc.status] || { cor: '#fff', texto: oc.status };
        resultado.innerHTML = `
            <p class="resultado-protocolo">PROTOCOLO: ${escapeHTML(oc.protocolo)}</p>
            <p class="resultado-tipo">${escapeHTML(oc.tipo)}</p>
            <p class="resultado-local"><i class="fas fa-map-marker-alt"></i> ${escapeHTML(oc.localizacao)}</p>
            <div style="background:${info.cor}22; border:1px solid ${info.cor}55; border-radius:10px; padding:12px 18px; display:inline-block;">
                <span style="font-weight:700; color:${info.cor}; font-size:0.9rem;">${info.texto}</span>
            </div>
            <p style="font-size:0.7rem; opacity:0.4; margin-top:15px;">Registrado em: ${new Date(oc.criado_em).toLocaleDateString('pt-BR')}</p>
        `;
    };

    // =========================================================
    //  13. MAPA — animais resgatados, com dados reais da API.
    //  (Antes mostrava 5 pontos fabricados que nunca mudavam;
    //  a variável de ocorrências reais era buscada e nunca usada.)
    //  Não mapeamos denúncias/ocorrências aqui de propósito — a
    //  localização exata de uma denúncia em análise é sensível,
    //  então só mostramos os animais já resgatados (dado público).
    // =========================================================
    const mapaEl = document.getElementById('mapa-leaflet');
    if (mapaEl && window.L) {
        const COORDENADAS_CIDADE = {
            'resende':       [-22.4707, -44.4423],
            'volta redonda': [-22.5231, -44.1042],
            'itatiaia':      [-22.4889, -44.5636],
        };
        const CENTRO_PADRAO = [-22.4900, -44.3900]; // meio do Sul Fluminense

        function coordenadasPara(localizacao) {
            const chave = (localizacao || '').toLowerCase();
            for (const cidade in COORDENADAS_CIDADE) {
                if (chave.includes(cidade)) return COORDENADAS_CIDADE[cidade];
            }
            return null;
        }

        const mapa = L.map('mapa-leaflet', { zoomControl: true }).setView(CENTRO_PADRAO, 10);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OpenStreetMap &copy; CARTO',
            maxZoom: 18,
        }).addTo(mapa);

        const icone = L.divIcon({
            html: '<div style="background:#c5a666; width:14px; height:14px; border-radius:50%; border:3px solid #fff; box-shadow:0 0 8px rgba(197,166,102,0.8);"></div>',
            className: '',
            iconSize: [14, 14],
        });

        fetch('/animais').then(r => r.ok ? r.json() : []).then(animais => {
            (animais || []).forEach(a => {
                const coords = coordenadasPara(a.localizacao) || CENTRO_PADRAO;
                L.marker(coords, { icon: icone })
                    .addTo(mapa)
                    .bindPopup(`<b style="color:#c5a666">${escapeHTML(a.nome)}</b><br><small>${escapeHTML(a.especie)} — ${escapeHTML(a.localizacao || 'Localização não informada')}</small>`);
            });
        }).catch(() => { /* API indisponível — mapa fica só com o mapa-base */ });
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
        if (!show) {
            modal.style.opacity = '0';
            modal.style.transition = 'opacity 0.25s ease';
            setTimeout(() => {
                modal.classList.remove('active');
                modal.style.opacity = '';
                modal.style.transition = '';
            }, 250);
        } else {
            modal.classList.add('active');
        }
        document.body.style.overflow = show ? 'hidden' : 'auto';
    };

    window.switchAuth = (mode) => {
        const isLogin = mode === 'login';
        document.getElementById('form-login').style.display = isLogin ? 'block' : 'none';
        document.getElementById('form-reg').style.display   = isLogin ? 'none'  : 'block';
        document.getElementById('tab-login').classList.toggle('active',  isLogin);
        document.getElementById('tab-reg').classList.toggle('active',   !isLogin);
    };

    window.toggleAdopt = (show, petIdOrName = '', petName) => {
        const modal = document.getElementById('adopt-modal');
        if (show) {
            // Compatibilidade: cards antigos chamam toggleAdopt(true, 'Nome') só com 2 args.
            // Cards renderizados dinamicamente chamam toggleAdopt(true, id, 'Nome').
            const temId  = petName !== undefined;
            const petId  = temId ? petIdOrName : null;
            const nome   = temId ? petName : petIdOrName;

            document.getElementById('target-pet-name').innerText = 'ANIMAL: ' + nome.toUpperCase();
            modal.dataset.petName = nome;
            modal.dataset.petId   = petId ?? '';
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
                const especialidade = formReg.querySelector('select[name="especialidade"]')?.value || 'Membro';
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

                formReg.reset();
                toggleAuth(false);

                const _mostrarSucessoCadastro = (userObj) => {
                    const nomeExib = nome ? `${nome} ${sobrenome || ''}`.trim() : email.split('@')[0];
                    Swal.fire({
                        icon: 'success',
                        title: '🎖️ Conta Criada!',
                        html: `
                            <div style="text-align:left;line-height:1.8;font-size:15px;">
                                <p style="margin:0 0 10px;font-size:17px;font-weight:600;color:#c9a84c;">
                                    Bem-vindo(a), ${nomeExib}!
                                </p>
                                <p style="margin:0 0 6px;opacity:.85;">Sua conta foi criada com sucesso no sistema GuardPets.</p>
                                <div style="background:rgba(201,168,76,.12);border:1px solid rgba(201,168,76,.35);border-radius:8px;padding:10px 14px;margin-top:12px;">
                                    <span style="color:#c9a84c;font-weight:600;">📧 Email cadastrado:</span><br>
                                    <span style="font-family:monospace;font-size:14px;">${email}</span>
                                </div>
                                <div style="margin-top:10px;font-size:13px;opacity:.7;">Especialidade: <b>${especialidade}</b></div>
                            </div>`,
                        confirmButtonText: 'Entrar no Sistema →',
                        confirmButtonColor: '#c9a84c',
                        background: '#1a1a2e',
                        color: '#e8e8e8',
                        customClass: { popup: 'swal-guardpets' }
                    });
                };

                // Se o Supabase retornou sessão direto (confirmação desativada), loga já
                if (data.access_token) {
                    localStorage.setItem('gp_supa_token', data.access_token);
                    mostrarPerfilAgente(data.user || { email, user_metadata: { nome, sobrenome, especialidade } });
                    _mostrarSucessoCadastro(data.user);
                } else {
                    // Tenta login automático
                    const login = await supaSignIn(email, senha);
                    if (login.access_token) {
                        localStorage.setItem('gp_supa_token', login.access_token);
                        mostrarPerfilAgente(login.user || { email, user_metadata: { nome, sobrenome, especialidade } });
                        _mostrarSucessoCadastro(login.user);
                    } else {
                        Swal.fire({
                            icon: 'success',
                            title: '✅ Conta criada!',
                            html: `Sua conta foi registrada.<br><b style="color:#c9a84c;">${email}</b><br><br>Faça login para entrar.`,
                            confirmButtonColor: '#c9a84c',
                            background: '#1a1a2e',
                            color: '#e8e8e8'
                        }).then(() => { switchAuth('login'); toggleAuth(true); });
                    }
                }

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
                toggleAuth(false);
                formLogin.reset();

                const metaLogin   = user.user_metadata || {};
                const nomeLogin   = metaLogin.nome ? `${metaLogin.nome} ${metaLogin.sobrenome || ''}`.trim() : (user.email || email).split('@')[0];
                const emailLogin  = user.email || email;
                const espLogin    = metaLogin.especialidade || 'Membro';
                const membroDesde = user.created_at
                    ? new Date(user.created_at).toLocaleDateString('pt-BR', { day:'2-digit', month:'long', year:'numeric' })
                    : '—';

                Swal.fire({
                    icon: 'success',
                    title: '🐾 Acesso Concedido!',
                    html: `
                        <div style="text-align:left;line-height:1.8;font-size:15px;">
                            <p style="margin:0 0 10px;font-size:17px;font-weight:600;color:#c9a84c;">
                                Bem-vindo(a) de volta, ${nomeLogin}!
                            </p>
                            <div style="background:rgba(201,168,76,.12);border:1px solid rgba(201,168,76,.35);border-radius:8px;padding:10px 14px;margin-top:6px;">
                                <span style="color:#c9a84c;font-weight:600;">📧 Conectado como:</span><br>
                                <span style="font-family:monospace;font-size:14px;">${emailLogin}</span>
                            </div>
                            <div style="margin-top:10px;font-size:13px;opacity:.7;">
                                Especialidade: <b>${espLogin}</b> &nbsp;|&nbsp; Membro desde: <b>${membroDesde}</b>
                            </div>
                        </div>`,
                    confirmButtonText: 'Continuar →',
                    confirmButtonColor: '#c9a84c',
                    background: '#1a1a2e',
                    color: '#e8e8e8',
                    timer: 5000,
                    timerProgressBar: true
                });

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
    //  5d. FORMULÁRIO DE ADOÇÃO
    //  POST /adocoes — não exige login (é o primeiro contato de
    //  quem quer adotar; se a pessoa estiver logada, a solicitação
    //  fica vinculada à conta dela, mas isso é opcional).
    //  [OBSERVER] → notificar('novo_agendamento') dispara o toast
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
                const modal    = document.getElementById('adopt-modal');
                const petNome  = modal?.dataset.petName || 'Animal';
                const petId    = modal?.dataset.petId;

                const payload = {
                    idAnimal:   petId ? Number(petId) : null,
                    nome:       formAdopt.querySelector('input[type="text"]')?.value || '',
                    telefone:   document.getElementById('adopt-phone')?.value || '',
                    residencia: formAdopt.querySelector('select')?.value      || '',
                    motivacao:  formAdopt.querySelector('textarea')?.value    || '',
                };

                if (!payload.idAnimal) throw new Error('Não foi possível identificar o animal. Recarregue a página e tente novamente.');

                const token   = localStorage.getItem('gp_supa_token');
                const headers = { 'Content-Type': 'application/json' };
                if (token) headers['Authorization'] = `Bearer ${token}`;

                const resp = await fetch('/adocoes', {
                    method:  'POST',
                    headers,
                    body:    JSON.stringify(payload),
                });
                const adocao = await resp.json();
                if (!resp.ok) throw new Error(adocao.error || 'Não foi possível enviar a solicitação.');

                // [OBSERVER] — Notifica sobre a nova solicitação de adoção
                GerenciadorEventos.notificar('novo_agendamento', { ...adocao, petNome });

                Swal.fire({
                    title:              'SOLICITAÇÃO ENVIADA!',
                    html:               `Prontuário de <strong>${petNome}</strong> solicitado!<br>
                                         Protocolo: <strong style="color:#c5a666">${adocao.protocolo}</strong>`,
                    icon:               'success',
                    confirmButtonColor: '#c5a666',
                });

                formAdopt.reset();
                toggleAdopt(false);
                carregarAnimais(); // animal passa a aparecer como "em processo"

            } catch (err) {
                Swal.fire('Erro', err.message || 'Não foi possível enviar a solicitação.', 'error');
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

    async function mostrarPerfilAgente(user) {
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
        set('pd-role',   meta.especialidade || 'Membro');

        // Busca no backend o id interno e o `tipo` (admin/adotante) reais —
        // o token do Supabase, sozinho, não diz se a conta é admin. Se a
        // primeira tentativa falhar (rede/DB com soluço), tenta mais uma vez
        // antes de desistir — cair pra "adotante" à toa esconde o painel
        // admin sem motivo real, e isso é exatamente o tipo de coisa que
        // pareceria um bug de permissão no meio de uma demonstração.
        const cache = JSON.parse(localStorage.getItem('gp_usuario') || 'null');
        let id   = user.id;
        let tipo = (cache && cache.email === user.email) ? cache.tipo : 'adotante';

        const token = localStorage.getItem('gp_supa_token');
        for (let tentativa = 0; tentativa < 2; tentativa++) {
            try {
                const resp = await fetch('/me', { headers: { 'Authorization': `Bearer ${token}` } });
                if (resp.ok) {
                    const me = await resp.json();
                    id   = me.id;
                    tipo = me.tipo;
                    break;
                }
            } catch (_) { /* tenta de novo (ou desiste, na segunda vez) */ }
            if (tentativa === 0) await new Promise(r => setTimeout(r, 800));
        }

        localStorage.setItem('gp_usuario',    JSON.stringify({ id, nome, email: user.email, tipo }));
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
        set('pm-badge',        meta.especialidade || 'Membro');
        set('pm-nome',         nome);
        set('pm-email',        user.email || '');
        set('pm-especialidade', meta.especialidade || 'Membro');
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
        if (nomeEl) nomeEl.textContent = usuario.email + ' — ' + (usuario.tipo || 'Membro');
        if (el) el.classList.add('active');
        document.body.style.overflow = 'hidden';

        const tabCadastro = document.getElementById('tab-cadastro-animal');
        if (tabCadastro) tabCadastro.style.display = usuario.tipo === 'admin' ? '' : 'none';

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
                        <div class="pdc-protocolo">${escapeHTML(oc.protocolo || 'SEM PROTOCOLO')}</div>
                        <div class="pdc-tipo">${escapeHTML(oc.tipo)}</div>
                        <div class="pdc-local"><i class="fas fa-map-marker-alt"></i> ${escapeHTML(oc.localizacao)}</div>
                        <div class="pdc-nome">Denunciante: ${escapeHTML(oc.nome_denunciante || oc.nome || 'Anônimo')}</div>
                    </div>
                </div>
                <div class="pdc-relato">${escapeHTML(oc.relato)}</div>
                <div class="pdc-footer">
                    <select class="pdc-status-select" id="status-sel-${i}">${statusOpts}</select>
                    <button class="pdc-btn-atualizar" onclick="atualizarStatus('${String(oc.id).replace(/'/g, '')}', 'status-sel-${i}')">
                        <i class="fas fa-save"></i> ATUALIZAR STATUS
                    </button>
                </div>
            </div>`;
        }).join('');
    }

    async function carregarAdocoes() {
        const lista = document.getElementById('lista-adocoes');
        const badge = document.getElementById('badge-adocoes');
        if (!lista) return;

        lista.innerHTML = '<div class="painel-vazio"><i class="fas fa-spinner fa-spin"></i> Carregando...</div>';

        let adocoes = [];
        let falhou  = false;
        const token = localStorage.getItem('gp_supa_token');
        try {
            const resp = await fetch('/adocoes', { headers: { 'Authorization': `Bearer ${token}` } });
            if (resp.ok) adocoes = await resp.json();
            else falhou = true;
        } catch (_) { falhou = true; }

        if (badge) badge.textContent = adocoes.length;

        if (falhou) {
            lista.innerHTML = '<div class="painel-vazio"><i class="fas fa-triangle-exclamation"></i> Não foi possível carregar as solicitações agora. Tente de novo em instantes.</div>';
            return;
        }

        if (adocoes.length === 0) {
            lista.innerHTML = '<div class="painel-vazio"><i class="fas fa-paw"></i>Nenhuma solicitação de adoção ainda.</div>';
            return;
        }

        const isAdmin = JSON.parse(localStorage.getItem('gp_usuario') || 'null')?.tipo === 'admin';

        lista.innerHTML = adocoes.map(ag => `
            <div class="painel-adocao-card">
                <div>
                    <div class="pac-pet">🐾 ${escapeHTML(ag.animal_nome || 'Animal')}</div>
                    <div class="pac-adotante">${escapeHTML(ag.nome_adotante || ag.usuario_nome || ag.usuario_email || 'Não informado')}</div>
                    <div class="pac-tel"><i class="fas fa-phone"></i> ${escapeHTML(ag.telefone || '—')}</div>
                    <div class="pac-residencia"><i class="fas fa-home"></i> ${escapeHTML(ag.residencia || '—')}</div>
                    <div class="pac-protocolo">${escapeHTML(ag.protocolo || '')} — <b style="color:var(--p-gold);">${escapeHTML((ag.status || '').toUpperCase())}</b></div>
                </div>
                <div style="font-size:0.75rem; color:rgba(255,255,255,0.3); max-width:220px; line-height:1.5;">
                    <b style="color:rgba(255,255,255,0.5);">Motivação:</b><br>${escapeHTML(ag.motivacao || '—')}
                </div>
                ${isAdmin && ag.status === 'pendente' ? `
                <div style="display:flex; gap:8px;">
                    <button class="pdc-btn-atualizar" onclick="decidirAdocao(${ag.id}, 'aprovada')">
                        <i class="fas fa-check"></i> APROVAR
                    </button>
                    <button class="pdc-btn-atualizar" style="color:var(--danger); border-color:rgba(220,53,69,0.35);" onclick="decidirAdocao(${ag.id}, 'recusada')">
                        <i class="fas fa-times"></i> RECUSAR
                    </button>
                </div>` : ''}
            </div>
        `).join('');
    }

    window.decidirAdocao = async (id, status) => {
        const token = localStorage.getItem('gp_supa_token');
        try {
            const resp = await fetch(`/adocoes/${id}/status`, {
                method:  'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body:    JSON.stringify({ status }),
            });
            if (!resp.ok) throw new Error((await resp.json()).error || 'Falha ao atualizar');

            GerenciadorEventos.exibirToast(
                status === 'aprovada' ? '✅ Adoção Aprovada' : '⛔ Adoção Recusada',
                status === 'aprovada' ? 'O animal foi marcado como adotado.' : 'O animal voltou a ficar disponível.',
                'sucesso'
            );
            carregarAdocoes();
            carregarAnimais();
        } catch (err) {
            Swal.fire('Erro', err.message, 'error');
        }
    };

    // ---------------------------------------------------------
    //  CADASTRO DE ANIMAL (admin) — foto vai pro Supabase Storage,
    //  o resto vai pra /animais (POST, exige admin).
    // ---------------------------------------------------------
    async function uploadFotoAnimal(arquivo) {
        const token = localStorage.getItem('gp_supa_token');
        const nomeArquivo = `${Date.now()}-${arquivo.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;

        const resp = await fetch(`${_SUPA_URL}/storage/v1/object/animais/${nomeArquivo}`, {
            method:  'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'apikey':        _SUPA_KEY,
                'Content-Type':  arquivo.type || 'application/octet-stream',
            },
            body: arquivo,
        });
        if (!resp.ok) throw new Error('Falha ao enviar a foto. Tente novamente.');
        return `${_SUPA_URL}/storage/v1/object/public/animais/${nomeArquivo}`;
    }

    const formCadastroAnimal = document.getElementById('form-cadastro-animal');
    if (formCadastroAnimal) {
        formCadastroAnimal.addEventListener('submit', async (e) => {
            e.preventDefault();
            const token = localStorage.getItem('gp_supa_token');
            if (!token) { Swal.fire('Erro', 'Faça login como administrador primeiro.', 'error'); return; }

            const btn = formCadastroAnimal.querySelector('button[type="submit"]');
            const textoOriginal = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> CADASTRANDO...';
            btn.disabled = true;

            try {
                const arquivo  = document.getElementById('ca-foto')?.files?.[0] || null;
                const foto_url = arquivo ? await uploadFotoAnimal(arquivo) : null;

                const payload = {
                    nome:        document.getElementById('ca-nome')?.value.trim(),
                    especie:     document.getElementById('ca-especie')?.value,
                    raca:        document.getElementById('ca-raca')?.value.trim() || 'SRD',
                    porte:       document.getElementById('ca-porte')?.value,
                    idade:       document.getElementById('ca-idade')?.value,
                    situacao:    document.getElementById('ca-situacao')?.value,
                    saude:       document.getElementById('ca-saude')?.value.trim() || null,
                    localizacao: document.getElementById('ca-localizacao')?.value.trim() || null,
                    descricao:   document.getElementById('ca-descricao')?.value.trim() || null,
                    castrado:    document.getElementById('ca-castrado')?.checked || false,
                    vacinado:    document.getElementById('ca-vacinado')?.checked || false,
                    foto_url,
                };

                const resp   = await fetch('/animais', {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body:    JSON.stringify(payload),
                });
                const animal = await resp.json();
                if (!resp.ok) throw new Error(animal.error || 'Não foi possível cadastrar o animal.');

                Swal.fire({
                    title: 'Animal cadastrado!',
                    text:  `${animal.nome} já está na vitrine de adoção.`,
                    icon:  'success',
                    confirmButtonColor: '#c5a666',
                });
                formCadastroAnimal.reset();
                carregarAnimais();
            } catch (err) {
                Swal.fire('Erro', err.message || 'Não foi possível cadastrar o animal.', 'error');
            } finally {
                btn.innerHTML = textoOriginal;
                btn.disabled  = false;
            }
        });
    }

    async function carregarStats() {
        const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        const token = localStorage.getItem('gp_supa_token');

        let ocs = db.getOcorrencias();
        let ags = [];
        try {
            const [rOcs, rAgs] = await Promise.all([
                fetch('/ocorrencias', { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch('/adocoes',     { headers: { 'Authorization': `Bearer ${token}` } }),
            ]);
            if (rOcs.ok) ocs = await rOcs.json();
            if (rAgs.ok) ags = await rAgs.json();
        } catch (_) { /* mantém fallback do localStorage para ocorrências */ }

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