// Service worker mínimo de la versión VR (2026-11-24): solo para que Chrome la ofrezca como app instalable
// (Agregar a la pantalla principal → Instalar), que se abre a pantalla completa y horizontal, sin la barra del
// navegador. No guarda nada en caché: cada pedido va a la red como siempre.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
