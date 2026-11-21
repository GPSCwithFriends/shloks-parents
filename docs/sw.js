// Keeps the app shell available offline. Data always comes live from the server.
const CACHE = 'shloks-parents-v5';
const SHELL = ['./', 'index.html', 'config.js', 'manifest.webmanifest', 'icons/logo-160.jpg', 'icons/icon-192.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;   // never touch API calls
  e.respondWith(fetch(req).then(res => {                                   // network first, so updates show at once
    const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res;
  }).catch(() => caches.match(req).then(r => r || caches.match('index.html'))));
});
