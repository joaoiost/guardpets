const CACHE = 'guardpets-v5';
// Nunca cacheia HTML — só assets estáticos
const STATIC = ['/index1.css', '/index1.js'];

self.addEventListener('install', e => {
    e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC)));
    self.skipWaiting();
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', e => {
    if (e.request.method !== 'GET') return;
    const url = e.request.url;
    // Sempre vai para a rede: HTML, APIs e CDNs externos
    if (url.endsWith('/') || url.includes('.html') ||
        /\/(login|register|me|denuncia|ocorrencias|health|animais|adocoes|usuarios)/.test(url) ||
        !url.startsWith(self.location.origin)) return;
    // Rede primeiro — garante que index1.js/index1.css atualizados cheguem
    // assim que publicados. O cache só serve de reserva se a rede falhar
    // (offline), pra não travar a pessoa numa versão antiga do site.
    e.respondWith(
        fetch(e.request)
            .then(resp => {
                const copia = resp.clone();
                caches.open(CACHE).then(c => c.put(e.request, copia));
                return resp;
            })
            .catch(() => caches.match(e.request))
    );
});
