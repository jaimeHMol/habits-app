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
    // A. Verificar soporte
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert('Error: Su navegador no soporta Notificaciones Push.');
      return null;
    }

    // B. Obtener SW (sin esperar infinitamente .ready)
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      alert('Error: No se encontró el Service Worker. ¿Añadió la app a Inicio?');
      return null;
    }
    
    // C. Pedir Permiso (Esto DEBE ser lo primero tras el click)
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      alert('Permiso Denegado. Por favor, habilite notificaciones para este sitio en los ajustes de Chrome.');
      return null;
    }

    // D. Obtener Llave Pública del Servidor
    let vapidPublicKey;
    try {
      const response = await taskApi.getVapidPublicKey();
      vapidPublicKey = response.public_key;
    } catch (e) {
      alert('Error de Red: No se pudo obtener la llave del servidor. ' + e.message);
      return null;
    }
    
    if (!vapidPublicKey) {
      alert('Error Backend: Llave VAPID vacía. Revise el .env del servidor.');
      return null;
    }

    // E. Suscribir
    alert('Suscribiendo dispositivo... por favor espere.');
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
    });

    // F. Enviar al Backend
    await taskApi.subscribePush(subscription);
    alert('¡Notificaciones Push activadas con éxito!');
    return subscription;

  } catch (error) {
    alert('Falla en suscripción: ' + error.name + ' - ' + error.message);
    console.error(error);
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
