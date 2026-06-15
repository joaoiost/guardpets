const CACHE = 'guardpets-v2';
const STATIC = ['/', '/index1.css', '/index1.js'];

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
    // Deixa chamadas de API sempre ir para a rede
    if (/\/(login|register|denuncia|ocorrencias|health|agendamentos)/.test(url)) return;
    e.respondWith(
        caches.match(e.request).then(cached => cached || fetch(e.request))
    );
});
