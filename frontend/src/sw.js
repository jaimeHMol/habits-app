import { precacheAndRoute } from 'workbox-precaching';

precacheAndRoute(self.__WB_MANIFEST);

const channel = new BroadcastChannel('reminders-channel');

self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    let title = payload.title || 'RECUERDA';
    const payloadData = payload.data || {};
    
    // Determine vibration pattern and title based on type
    const isTimer = payloadData.type === 'timer_end';
    const vibratePattern = isTimer 
      ? [500, 200, 500, 200, 1000] // Long pulses for alarm
      : [200, 100, 200];           // Short pop for normal reminder

    if (isTimer) {
      title = `⏳ ${title}`;
    }
    
    const options = {
      body: payload.body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      data: payloadData,
      vibrate: vibratePattern,
      tag: 'habit-reminder',
      renotify: true,
      requireInteraction: isTimer // Require interaction for timers so it stays on screen until dismissed
    };

    // Notify the app if it's open
    channel.postMessage({ type: 'PUSH_RECEIVED', payload: { title: payload.title, ...options } });

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
