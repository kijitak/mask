'use strict';

const SHELL_CACHE = 'mask-shell-v0.6.1';
const OCR_CACHE = 'mask-ocr-v5.0.0-best';
const SHELL = [
  './', './index.html', './style.css', './app.js', './manifest.webmanifest'
];

// First-time only: download OCR runtime/model files and store them under same-origin virtual URLs.
// After this completes, OCR loads only from Cache Storage and works offline.
const OCR_ASSETS = [
  ['./offline/tesseract.min.js', 'https://cdn.jsdelivr.net/npm/tesseract.js@5.0.0/dist/tesseract.min.js'],
  ['./offline/worker.min.js', 'https://cdn.jsdelivr.net/npm/tesseract.js@5.0.0/dist/worker.min.js'],
  ['./offline/core/tesseract-core.wasm.js', 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.0.0/tesseract-core.wasm.js'],
  ['./offline/core/tesseract-core.wasm', 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.0.0/tesseract-core.wasm'],
  ['./offline/core/tesseract-core-simd.wasm.js', 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.0.0/tesseract-core-simd.wasm.js'],
  ['./offline/core/tesseract-core-simd.wasm', 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.0.0/tesseract-core-simd.wasm'],
  ['./offline/core/tesseract-core-lstm.wasm.js', 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.0.0/tesseract-core-lstm.wasm.js'],
  ['./offline/core/tesseract-core-lstm.wasm', 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.0.0/tesseract-core-lstm.wasm'],
  ['./offline/core/tesseract-core-simd-lstm.wasm.js', 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.0.0/tesseract-core-simd-lstm.wasm.js'],
  ['./offline/core/tesseract-core-simd-lstm.wasm', 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.0.0/tesseract-core-simd-lstm.wasm'],
  ['./offline/lang/jpn.traineddata.gz', 'https://raw.githubusercontent.com/naptha/tessdata/gh-pages/4.0.0_best/jpn.traineddata.gz'],
  ['./offline/lang/eng.traineddata.gz', 'https://raw.githubusercontent.com/naptha/tessdata/gh-pages/4.0.0_best/eng.traineddata.gz']
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL_CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keep = new Set([SHELL_CACHE, OCR_CACHE]);
    for (const key of await caches.keys()) if (!keep.has(key)) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // OCR virtual files exist only in Cache Storage, so always prefer the cached copy.
  if (url.pathname.includes('/offline/')) {
    event.respondWith((async () => {
      const cached = await caches.match(event.request, { ignoreSearch: true });
      return cached || new Response('OCR asset unavailable', { status: 503 });
    })());
    return;
  }

  // For the app shell, prefer the network while online so a new release is not
  // permanently hidden behind an older service-worker cache. Fall back to cache offline.
  event.respondWith((async () => {
    try {
      const fresh = await fetch(event.request, { cache: 'no-store' });
      if (fresh && fresh.ok && url.origin === self.location.origin) {
        const cache = await caches.open(SHELL_CACHE);
        cache.put(event.request, fresh.clone());
      }
      return fresh;
    } catch (_) {
      const cached = await caches.match(event.request, { ignoreSearch: true });
      if (cached) return cached;
      if (event.request.mode === 'navigate') {
        const fallback = await caches.match('./index.html');
        if (fallback) return fallback;
      }
      return new Response('Offline', { status: 503, statusText: 'Offline' });
    }
  })());
});

async function isOcrReady() {
  const cache = await caches.open(OCR_CACHE);
  for (const [local] of OCR_ASSETS) {
    const url = new URL(local, self.registration.scope).href;
    if (!(await cache.match(url))) return false;
  }
  return true;
}

async function broadcast(payload) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
  clients.forEach(client => client.postMessage(payload));
}

async function cacheOcrAssets() {
  const cache = await caches.open(OCR_CACHE);
  const total = OCR_ASSETS.length;
  let done = 0;
  for (const [local, remote] of OCR_ASSETS) {
    const localUrl = new URL(local, self.registration.scope).href;
    if (!(await cache.match(localUrl))) {
      const response = await fetch(remote, { mode: 'cors', cache: 'no-store' });
      if (!response.ok) throw new Error(`OCR asset fetch failed: ${remote} (${response.status})`);
      await cache.put(localUrl, response.clone());
    }
    done += 1;
    await broadcast({ type: 'OCR_CACHE_PROGRESS', done, total });
  }
  await broadcast({ type: 'OCR_CACHE_READY' });
}

self.addEventListener('message', event => {
  const type = event.data && event.data.type;
  if (type === 'GET_OCR_STATUS') {
    event.waitUntil(isOcrReady().then(ready => event.source && event.source.postMessage({ type: 'OCR_STATUS', ready })));
  }
  if (type === 'CACHE_OCR_ASSETS') {
    event.waitUntil(cacheOcrAssets().catch(async error => {
      await broadcast({ type: 'OCR_CACHE_ERROR', message: String(error && error.message || error) });
    }));
  }
  if (type === 'CLEAR_OCR_CACHE') {
    event.waitUntil(caches.delete(OCR_CACHE).then(() => broadcast({ type: 'OCR_STATUS', ready: false })));
  }
});
