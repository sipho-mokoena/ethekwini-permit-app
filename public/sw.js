const CACHE_NAME = 'spaza-registration-v1'
const urlsToCache = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  )
})

self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return
  }
  
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        if (response) {
          return response
        }
        
        // For API requests, try network first
        if (event.request.url.includes('/v1/')) {
          return fetch(event.request).catch(() => {
            // Return offline page for API failures
            return new Response('Offline', { status: 503 })
          })
        }
        
        // For navigation requests, serve the root index.html
        if (event.request.mode === 'navigate') {
          return caches.match('/') || fetch(event.request)
        }
        
        return fetch(event.request)
      })
      .catch(() => {
        // If we're offline and it's a navigation request, return the cached root
        if (event.request.mode === 'navigate') {
          return caches.match('/')
        }
        return new Response('Network Error', { status: 500 })
      })
  )
})