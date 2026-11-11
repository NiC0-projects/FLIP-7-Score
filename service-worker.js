/* Service worker di Flip 7. Per pubblicare un aggiornamento cambia CACHE_VERSION: le vecchie cache vengono eliminate. */
const CACHE_VERSION = "v2";
const CACHE = "flip7-" + CACHE_VERSION;
const CORE = [
  "./", "./index.html", "./manifest.json", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/icon-maskable-512.png", "./icons/apple-touch-icon.png", "./icons/apple-touch-icon-152.png", "./icons/apple-touch-icon-167.png", "./icons/favicon-32.png", "./icons/favicon-16.png"];

self.addEventListener("install", (e) => {
  // Ogni file viene salvato singolarmente: se uno manca (es. icona non ancora caricata) l'installazione NON fallisce.
  // Solo la pagina principale è indispensabile.
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      Promise.allSettled(CORE.map((u) => c.add(new Request(u, { cache: "reload" })))).then((r) => {
        if (r[1].status === "rejected" && r[0].status === "rejected") throw new Error("index.html non raggiungibile");
      })
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith("flip7-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Pagina principale: prima la rete (così gli aggiornamenti arrivano subito), se offline la copia in cache.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put("./index.html", copy)); return res; })
        .catch(() => caches.match("./index.html").then((r) => r || caches.match("./")))
    );
    return;
  }

  // Altre risorse (stesso sito, Google Fonts): cache subito, aggiornamento in background.
  const ok = url.origin === self.location.origin || url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (!ok) return;
  e.respondWith(
    caches.match(req).then((cached) => {
      const net = fetch(req).then((res) => {
        if (res && (res.ok || res.type === "opaque")) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      }).catch(() => cached);
      return cached || net;
    })
  );
});
