const CACHE_NAME = "static-cache-v2";
const DATA_CACHE_NAME = "data-cache-v1";

// map out icon sizes
const imgSizes = ["192", "512"];
const imgsToCache = imgSizes.map(size => `/icons/icon-${size}x${size}.png`);

const staticCacheList = [
  "/",
  "/index.js",
  "/styles.css",
  "/manifest.webmanifest",
  // may need to add a css file too
  ...imgsToCache
];

// sw install
self.addEventListener('install', function (evt) {
  evt.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(staticCacheList))
  );
  self.skipWaiting();
});

// sw on activate
self.addEventListener('activate', function(evt) {
  evt.waitUntil(
    caches.keys().then(keyList => {
      return Promise.all(
        keyList.map(key => {
          if (key !== CACHE_NAME && key !== DATA_CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );

  self.clients.claim();
});

// fetch
self.addEventListener("fetch", function(evt) {
  const {url} = evt.request;
  if (url.includes("/api/") && evt.request.method === "GET") {
    evt.respondWith(
      caches.open(DATA_CACHE_NAME).then(cache => {
        return fetch(evt.request)
          .then(response => {
            if (response.status === 200) {
              cache.put(evt.request, response.clone());
            }

            return response;
          })
          .catch(err => {
            return cache.match(evt.request);
          });
      }).catch(err => console.log("err", err))
    );
  } else {
    evt.respondWith(
      caches.open(CACHE_NAME).then(cache => {
        return cache.match(evt.request).then(response => {
          return response || fetch(evt.request);
        });
      })
    );
  }
});
