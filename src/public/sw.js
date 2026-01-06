const CACHE_NAME = 'story-app-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/styles/styles.css',
  '/scripts/index.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
];

self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching files');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.log('Service Worker: Cache failed', error);
      })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }

  if (url.origin === 'https://story-api.dicoding.dev') {
    if (request.method !== 'GET') {
      return;
    }

    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseClone = response.clone();
          
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
          
          return response;
        })
        .catch(() => {
          return caches.match(request);
        })
    );
    return;
  }

  event.respondWith(
    caches.match(request)
      .then((response) => {
        if (response) {
          return response;
        }
        
        if (request.method !== 'GET') {
          return fetch(request);
        }

        return fetch(request).then((response) => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });

          return response;
        });
      })
      .catch(() => {
        return new Response('Offline - Konten tidak tersedia', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({
            'Content-Type': 'text/plain',
          }),
        });
      })
  );
});

self.addEventListener('push', (event) => {
  console.log('Service Worker: Push notification received', event);
  
  let notificationTitle = 'Story App';
  let notificationOptions = {
    body: 'Ada cerita baru!',
    icon: '/favicon.png',
    badge: '/favicon.png',
    data: {
      url: '/',
    },
  };

  if (event.data) {
    try {
      const data = event.data.json();
      console.log('Push data received:', data);
      
      if (data.title) {
        notificationTitle = data.title;
      }
      
      if (data.options) {
        notificationOptions = {
          body: data.options.body || 'Ada cerita baru!',
          icon: data.options.icon || '/favicon.png',
          badge: '/favicon.png',
          image: data.options.image,
          data: {
            url: data.options.url || '/',
            storyId: data.options.storyId,
          },
          actions: [
            {
              action: 'open',
              title: 'Lihat Cerita',
              icon: '/favicon.png',
            },
            {
              action: 'close',
              title: 'Tutup',
            },
          ],
          requireInteraction: false,
          vibrate: [200, 100, 200],
        };
      }
    } catch (error) {
      console.error('Error parsing push data:', error);
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationTitle, notificationOptions)
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

self.addEventListener('sync', (event) => {
  console.log('Service Worker: Background sync', event.tag);
  
  if (event.tag === 'sync-stories') {
    event.waitUntil(syncStories());
  }
});

async function syncStories() {
  try {
    const db = await openIndexedDB();
    const offlineStories = await getOfflineStories(db);
    
    if (offlineStories.length === 0) {
      console.log('No offline stories to sync');
      return;
    }

    console.log(`Syncing ${offlineStories.length} offline stories`);

    for (const story of offlineStories) {
      try {
        const formData = new FormData();
        formData.append('description', story.description);
        formData.append('lat', story.lat);
        formData.append('lon', story.lon);
        
        if (story.photo) {
          const photoBlob = await fetch(story.photo).then(r => r.blob());
          formData.append('photo', photoBlob, 'photo.jpg');
        }

        const token = story.token;
        
        const response = await fetch('https://story-api.dicoding.dev/v1/stories', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formData,
        });

        if (response.ok) {
          await deleteOfflineStory(db, story.id);
          console.log('Story synced successfully:', story.id);
        }
      } catch (error) {
        console.error('Failed to sync story:', error);
      }
    }
  } catch (error) {
    console.error('Sync failed:', error);
  }
}

function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('StoryAppDB', 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getOfflineStories(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['offline-stories'], 'readonly');
    const store = transaction.objectStore('offline-stories');
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function deleteOfflineStory(db, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['offline-stories'], 'readwrite');
    const store = transaction.objectStore('offline-stories');
    const request = store.delete(id);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
