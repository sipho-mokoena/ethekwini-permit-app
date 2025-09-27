const CACHE_NAME = 'spaza-registration-v1'
const urlsToCache = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json'
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  )
})

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        if (response) {
          return response
        }
        
        // For API requests, try network first
        if (event.request.url.includes('/api/') || event.request.url.includes('/v1/')) {
          return fetch(event.request).catch(() => {
            // Return offline page for API failures
            return new Response('Offline', { status: 503 })
          })
        }
        
        return fetch(event.request)
      })
  )
})