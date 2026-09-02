const CACHE_NAME = 'carhopgo-shell-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', event => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'CarHopGo';
  const options = {
    body: payload.body || 'You have a new notification.',
    icon: payload.icon || '/favicon.png',
    badge: payload.badge || '/favicon.png',
    tag: payload.tag || 'carhopgo-notification',
    data: payload.data || {},
    vibrate: payload.vibrate || [180, 80, 180],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const bookingId = event.notification.data && event.notification.data.bookingId;
  const targetUrl = event.notification.data && event.notification.data.targetUrl
    ? event.notification.data.targetUrl
    : bookingId
      ? `/?view=admin&tab=bookings&bookingId=${encodeURIComponent(bookingId)}`
      : '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const existing = clients.find(client => 'focus' in client);
      if (existing) {
        existing.navigate(targetUrl);
        return existing.focus();
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});