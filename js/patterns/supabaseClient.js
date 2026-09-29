/**
 * =============================================================
 *  [SINGLETON] Cliente oficial do Supabase (supabase-js)
 * =============================================================
 *  Única instância do client usada no front — hoje serve para
 *  Realtime (escutar mudanças no banco ao vivo). O login/cadastro
 *  continua via REST direto em index1.js (supaSignIn/supaSignUp);
 *  isso não muda aqui, só a parte de tempo real usa este client.
 *
 *  URL/anon key moram só aqui — window.SUPABASE_URL/ANON_KEY —
 *  pra não ter uma segunda cópia da chave em outro arquivo
 *  (senão, rotacionar a chave um dia exige lembrar de trocar
 *  em dois lugares).
 * =============================================================
 */
window.SUPABASE_URL      = 'https://phevudghxypjobpbvckk.supabase.co';
window.SUPABASE_ANON_KEY = 'sb_publishable__cSb0PEa3CkwyMG1O5kaaQ_wrfNSH2V';

window.supabaseClient = (window.supabase && window.SUPABASE_URL && window.SUPABASE_ANON_KEY)
    ? window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY)
    : null;

console.log('[Singleton] Cliente Supabase (Realtime) inicializado:', !!window.supabaseClient);
