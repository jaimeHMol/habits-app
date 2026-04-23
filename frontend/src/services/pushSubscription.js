import { taskApi } from './api';

const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

export const subscribeToPush = async () => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    alert('Push not supported by browser');
    return null;
  }

  try {
    // 1. Check Service Worker Status
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      alert('No Service Worker found. Try reloading or re-installing the PWA.');
      return null;
    }

    // 2. Request Permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      alert('Notification permission denied. Please enable it in browser settings.');
      return null;
    }
    
    // 3. Get VAPID public key
    const response = await taskApi.getVapidPublicKey();
    const vapidPublicKey = response.public_key;
    
    if (!vapidPublicKey || vapidPublicKey === '') {
      alert('Backend Error: VAPID public key is empty. Check .env in server.');
      return null;
    }

    // 4. Subscribe
    console.log('Subscribing with key:', vapidPublicKey);
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
    });

    // Send subscription to backend
    await taskApi.subscribePush(subscription);
    console.log('Successfully subscribed to Push Notifications');
    return subscription;
  } catch (error) {
    console.error('Failed to subscribe to push notifications:', error);
    return null;
  }
};

export const unsubscribeFromPush = async () => {
  if (!('serviceWorker' in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      await subscription.unsubscribe();
      await taskApi.unsubscribePush(subscription);
      console.log('Successfully unsubscribed from Push Notifications');
    }
  } catch (error) {
    console.error('Failed to unsubscribe from push notifications:', error);
  }
};

export const checkPushSubscription = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return !!subscription;
};
