import { precacheAndRoute } from 'workbox-precaching';

precacheAndRoute(self.__WB_MANIFEST);

const channel = new BroadcastChannel('reminders-channel');

self.addEventListener('push', (event) => {
  // TRUCO DE DEBUG: Avisar a la app que el SW recibió ALGO
  channel.postMessage({ type: 'DEBUG', message: 'SW: ¡Evento PUSH recibido!' });

  if (!event.data) {
    channel.postMessage({ type: 'DEBUG', message: 'SW: Evento push sin datos' });
    return;
  }

  try {
    const payload = event.data.json();
    const title = payload.title || 'RECUERDA';
    
    const options = {
      body: payload.body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      data: payload.data || {},
      vibrate: [300, 100, 400],
      tag: 'habit-reminder',
      renotify: true
    };

    channel.postMessage({ type: 'PUSH_RECEIVED', payload: { title, ...options } });

    event.waitUntil(
      self.registration.showNotification(title, options)
    );
    
  } catch (err) {
    channel.postMessage({ type: 'DEBUG', message: 'SW ERROR: ' + err.message });
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('/');
    })
  );
});
