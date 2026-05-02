import { taskApi } from './api';

const urlBase64ToUint8Array = (base64String) => {
  // 1. Clean the string: remove whitespace, quotes, or newlines
  const cleanedString = base64String.trim().replace(/["']/g, '');
  
  // 2. Standardize Base64URL to Base64
  const padding = '='.repeat((4 - (cleanedString.length % 4)) % 4);
  const base64 = (cleanedString + padding)
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
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return null;
    }

    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return null;
    
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    const response = await taskApi.getVapidPublicKey();
    const vapidPublicKey = response.public_key;
    
    if (!vapidPublicKey) return null;
// 3. Subscribe
const subscription = await registration.pushManager.subscribe({
  userVisibleOnly: true,
  applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
});

// 4. Send subscription to backend
await taskApi.subscribePush(subscription);
return subscription;

  } catch (error) {
    console.error('Push subscription failed:', error);
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
