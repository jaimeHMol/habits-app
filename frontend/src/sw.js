import { precacheAndRoute } from 'workbox-precaching';

precacheAndRoute(self.__WB_MANIFEST);

const channel = new BroadcastChannel('reminders-channel');

self.addEventListener('push', (event) => {
  if (!event.data) return;

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
      renotify: true,
      requireInteraction: false
    };

    // Notify the app if it's open
    channel.postMessage({ type: 'PUSH_RECEIVED', payload: { title, ...options } });

    // Show native notification
    event.waitUntil(
      self.registration.showNotification(title, options)
    );
    
  } catch (err) {
    console.error('Push event error:', err);
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
