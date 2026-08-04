/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { CacheFirst, NetworkFirst, NetworkOnly } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { CacheableResponsePlugin } from "workbox-cacheable-response";

declare const self: ServiceWorkerGlobalScope;

/**
 * Caching strategy, per resource type.
 *
 * The governing constraint: this app is used during a flood, on a phone, on a
 * connection that may be intermittent or gone. Stale-but-present beats absent —
 * EXCEPT where stale data would actively mislead.
 */

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// --- app shell -------------------------------------------------------------
// Hashed build assets are immutable, so cache-first is safe and instant.
registerRoute(
  ({ request }) => ["style", "script", "worker", "font"].includes(request.destination),
  new CacheFirst({
    cacheName: "kcc-assets",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 80, maxAgeSeconds: 30 * 24 * 60 * 60 }),
    ],
  }),
);

// --- OSM tiles -------------------------------------------------------------
// Immutable per z/x/y, and re-fetching them over a weak connection is the
// slowest part of the map.
registerRoute(
  ({ url }) => url.hostname.endsWith("tile.openstreetmap.org"),
  new CacheFirst({
    cacheName: "kcc-tiles",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 }),
    ],
  }),
);

// --- signed photo URLs -----------------------------------------------------
// NEVER cached: the signature expires after an hour, so a cached response
// becomes a broken image rather than a stale one.
registerRoute(
  ({ url }) => url.pathname.includes("/storage/v1/object/sign/"),
  new NetworkOnly(),
);

// --- write paths and admin -------------------------------------------------
// Replaying or serving these from cache would be actively wrong.
registerRoute(
  ({ url, request }) =>
    url.pathname.startsWith("/api/") &&
    (request.method !== "GET" ||
      url.pathname.includes("/admin/") ||
      url.pathname.includes("/otp/")),
  new NetworkOnly(),
);

// --- public API reads ------------------------------------------------------
// Try the network briefly, fall back to the last good response. A camp list
// from an hour ago is far better than an error page.
registerRoute(
  ({ url, request }) => url.pathname.startsWith("/api/") && request.method === "GET",
  new NetworkFirst({
    cacheName: "kcc-api",
    networkTimeoutSeconds: 4,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 24 * 60 * 60 }),
    ],
  }),
);

// --- navigations -----------------------------------------------------------
// Fall back to the precached shell; if even that is missing, offline.html is a
// static page with the emergency numbers as plain tel: links and no JS at all.
registerRoute(
  new NavigationRoute(
    new NetworkFirst({
      cacheName: "kcc-pages",
      networkTimeoutSeconds: 4,
      plugins: [new CacheableResponsePlugin({ statuses: [0, 200] })],
    }),
    { denylist: [/^\/api\//] },
  ),
);

self.addEventListener("install", () => {
  void self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// The page asks for the update; we never force a reload, because that would
// discard a half-completed report.
self.addEventListener("message", (event) => {
  if ((event.data as { type?: string } | undefined)?.type === "SKIP_WAITING") {
    void self.skipWaiting();
  }
});
