import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

precacheAndRoute(self.__WB_MANIFEST);

const channel = new BroadcastChannel('reminders-channel');

// Cache API GET requests for offline read support
registerRoute(
  ({ request, url }) => {
    // Only cache GET requests
    if (request.method !== 'GET') return false;
    
    // API paths to cache
    const apiPaths = ['/tasks', '/users/me', '/reminders', '/pomodoros'];
    return apiPaths.some(path => url.pathname.startsWith(path));
  },
  new NetworkFirst({
    cacheName: 'api-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 24 * 60 * 60, // 24 hours
      }),
      {
        fetchDidFail: async () => {
          channel.postMessage({ type: 'SERVER_OFFLINE' });
        },
        fetchDidSucceed: async ({ response }) => {
          if (response && response.status < 500) {
            channel.postMessage({ type: 'SERVER_ONLINE' });
          }
          return response;
        }
      }
    ],
  })
);

self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    let title = payload.title || 'RECUERDA';
    const payloadData = payload.data || {};
    
    // Determine vibration pattern and title based on type
    const isTimer = payloadData.type === 'timer_end';
    const isPomodoroFocus = payloadData.type === 'pomodoro_focus_end';
    const isPomodoroBreak = payloadData.type === 'pomodoro_break_end';
    const isPomodoro = isPomodoroFocus || isPomodoroBreak;
    const isUrgentTimer = isTimer || isPomodoro;

    const vibratePattern = isUrgentTimer 
      ? [500, 200, 500, 200, 1000] // Long pulses for alarm
      : [200, 100, 200];           // Short pop for normal reminder

    if (isTimer) {
      title = `⏳ ${title}`;
    } else if (isPomodoro) {
      title = `🍅 ${title}`;
    }

    // Use unique tags per notification source to prevent silent replacement
    let tag = `reminder-${payloadData.reminder_id || payloadData.task_id || Date.now()}`;
    if (isTimer) {
      tag = `timer-${payloadData.task_id}`;
    } else if (isPomodoro) {
      tag = `pomodoro-${payloadData.pomodoro_id}-${payloadData.type}`;
    }
    
    const options = {
      body: payload.body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      data: payloadData,
      vibrate: vibratePattern,
      tag,
      renotify: true,
      requireInteraction: isUrgentTimer // Require interaction for timers so it stays on screen until dismissed
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

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const subOptions = event.oldSubscription?.options || { userVisibleOnly: true };
        const newSub =
          event.newSubscription ||
          (await self.registration.pushManager.subscribe(subOptions));

        const p256dh = btoa(
          String.fromCharCode.apply(null, new Uint8Array(newSub.getKey('p256dh')))
        );
        const auth = btoa(
          String.fromCharCode.apply(null, new Uint8Array(newSub.getKey('auth')))
        );

        await fetch('/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: newSub.endpoint,
            p256dh,
            auth,
          }),
          credentials: 'include',
        });
      } catch (err) {
        console.error('Failed to renew push subscription:', err);
      }
    })()
  );
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
