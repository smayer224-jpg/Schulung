// Offline-Helfer (Service Worker)
// Er legt die App-Dateien auf dem Handy ab, damit die App auch ohne Internet startet.
// Wenn Internet da ist, holt er immer die neueste Version.

const CACHE_NAME = "pferde-kalender-v1";

const APP_DATEIEN = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
];

// Beim Installieren: alle App-Dateien ablegen
self.addEventListener("install", (ereignis) => {
  ereignis.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_DATEIEN))
  );
  self.skipWaiting();
});

// Beim Aktivieren: alte Ablagen von früheren Versionen löschen
self.addEventListener("activate", (ereignis) => {
  ereignis.waitUntil(
    caches.keys().then((namen) =>
      Promise.all(namen.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)))
    )
  );
  self.clients.claim();
});

// Bei jeder Anfrage: zuerst aus dem Internet, sonst aus der Ablage
self.addEventListener("fetch", (ereignis) => {
  if (ereignis.request.method !== "GET") return;
  if (new URL(ereignis.request.url).origin !== self.location.origin) return;

  ereignis.respondWith(
    fetch(ereignis.request)
      .then((antwort) => {
        if (antwort.ok) {
          const kopie = antwort.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(ereignis.request, kopie));
        }
        return antwort;
      })
      .catch(() =>
        caches.match(ereignis.request, { ignoreSearch: true }).then(
          (gespeichert) => gespeichert || caches.match("./index.html")
        )
      )
  );
});
