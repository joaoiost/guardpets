const CACHE = 'guardpets-v3';
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
        /\/(login|register|denuncia|ocorrencias|health|agendamentos)/.test(url) ||
        !url.startsWith(self.location.origin)) return;
    e.respondWith(
        caches.match(e.request).then(cached => cached || fetch(e.request))
    );
});
