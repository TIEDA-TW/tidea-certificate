/* 離線快取（其他課程底圖第一次使用時自動快取）：首次開啟後，字型與所有模組皆存在本機，之後開啟幾乎瞬間可用 */
const VERSION = 'cert-v2-multi';
const CORE = [
  './', 'index.html', 'css/style.css', 'js/courses.js', 'js/layout.js', 'js/data.js', 'js/pdf.js', 'js/app.js',
  'manifest.webmanifest', 'assets/courses/minecraft-preview.jpg', 'assets/cmap.json', 'assets/icon-192.png',
];
const LAZY = ['assets/font.ttf', 'assets/courses/minecraft.jpg', 'vendor/pdf-lib.min.js', 'vendor/fontkit.umd.min.js', 'vendor/jszip.min.js', 'vendor/xlsx.full.min.js'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE).then(() => c.addAll(LAZY).catch(() => {}))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const isCode = /\.(html|js|css|webmanifest)$/.test(new URL(req.url).pathname) || req.mode === 'navigate';
  if (isCode) {
    // 程式檔：網路優先（部署更新可立即生效），離線時用快取
    e.respondWith(fetch(req).then((res) => { const cp = res.clone(); caches.open(VERSION).then((c) => c.put(req, cp)); return res; })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('index.html'))));
  } else {
    // 字型、圖片、函式庫：快取優先
    e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const cp = res.clone(); caches.open(VERSION).then((c) => c.put(req, cp)); }
      return res;
    })));
  }
});
