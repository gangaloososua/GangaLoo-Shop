// Service Worker — pass-through only, no caching of API calls
const CACHE_NAME = 'gangaloo-v3';
const SUPABASE_HOST = 'supabase.co';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Never intercept Supabase or any external API — let browser handle natively
  if (url.includes(SUPABASE_HOST) || !url.startsWith(self.location.origin)) {
    return; // Do NOT call e.respondWith() — browser handles it directly
  }

  // For same-origin requests, network first, fall back to cache
  e.respondWith(
    fetch(e.request)
      .then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(e.request))
  );
});
