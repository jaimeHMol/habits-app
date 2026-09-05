import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

precacheAndRoute(self.__WB_MANIFEST);

// Cache API GET requests for offline read support
registerRoute(
  ({ request, url }) => {
    // Only cache GET requests
    if (request.method !== 'GET') return false;
    
    // API paths to cache
    const apiPaths = ['/tasks', '/users/me', '/reminders'];
    return apiPaths.some(path => url.pathname.startsWith(path));
  },
  new NetworkFirst({
    cacheName: 'api-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 24 * 60 * 60, // 24 hours
      }),
    ],
  })
);

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

    // Use unique tags per notification source to prevent silent replacement
    const tag = isTimer
      ? `timer-${payloadData.task_id}`
      : `reminder-${payloadData.reminder_id || payloadData.task_id || Date.now()}`;
    
    const options = {
      body: payload.body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      data: payloadData,
      vibrate: vibratePattern,
      tag,
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
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Try to focus an existing window for the same origin
      for (const client of clientList) {
        try {
          const clientUrl = new URL(client.url);
          if (clientUrl.origin === self.location.origin && 'focus' in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        } catch (e) {
          // Skip malformed URLs
        }
      }
      // No existing window — open a new one
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// Allow SW to skip waiting and activate immediately when commanded
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
