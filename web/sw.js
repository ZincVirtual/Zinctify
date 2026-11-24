/* Zinctify: service worker. Solo guarda la propia aplicación (index, app.js, estilos, fuentes) para que
   abra aunque no haya conexión. La música descargada se guarda aparte, en IndexedDB (ver app.js). */
const SHELL = "zinctify-shell-v12";
const SHELL_FILES = ["/", "/index.html", "/app.js", "/style.css", "/guard.js", "/logo.svg", "/manifest.webmanifest", "/icon-192.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => Promise.all(SHELL_FILES.map((f) => c.add(f).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== SHELL).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  const p = url.pathname;
  const isShell = req.mode === "navigate" || SHELL_FILES.includes(p) || p.startsWith("/fonts/");
  if (!isShell) return;                                   // la API y la música van siempre a la red
  const key = req.mode === "navigate" ? "/" : p;
  e.respondWith(
    fetch(req).then((res) => {
      if (res && res.ok) { const copy = res.clone(); caches.open(SHELL).then((c) => c.put(key, copy)); }
      return res;
    }).catch(() => caches.match(key).then((hit) => hit || Response.error()))
  );
});
