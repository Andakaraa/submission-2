class NotificationHelper {
  constructor() {
    this.vapidPublicKey = 'BP9ib2XGOTbm5T3jFNrcsMKWRZvCLGC7fANq-cz4rvfXcBb3wF_WlQBFmPZM2GNy_OXCNSlPvz_hX5XFpN5bJFQ';
  }

  async checkPermission() {
    if (!('Notification' in window)) {
      console.log('Browser tidak mendukung notifikasi');
      return false;
    }

    if (Notification.permission === 'denied') {
      console.log('Notifikasi diblokir oleh pengguna');
      return false;
    }

    return true;
  }

  async requestPermission() {
    if (!await this.checkPermission()) {
      return false;
    }

    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }

    return Notification.permission === 'granted';
  }

  async subscribePushNotification() {
    try {
      const registration = await navigator.serviceWorker.ready;

      // Check if already subscribed
      let subscription = await registration.pushManager.getSubscription();
      
      if (!subscription) {
        // Subscribe to push notifications
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this.urlBase64ToUint8Array(this.vapidPublicKey),
        });
      }

      // Send subscription to server
      await this.sendSubscriptionToServer(subscription);
      
      console.log('Push notification subscription successful');
      return subscription;
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      throw error;
    }
  }

  async unsubscribePushNotification() {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();
        console.log('Push notification unsubscribed');
        return true;
      }

      return false;
    } catch (error) {
      console.error('Failed to unsubscribe from push notifications:', error);
      throw error;
    }
  }

  async isSubscribed() {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      return subscription !== null;
    } catch (error) {
      return false;
    }
  }

  async sendSubscriptionToServer(subscription) {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch('https://story-api.dicoding.dev/v1/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(subscription),
      });

      if (!response.ok) {
        throw new Error('Failed to send subscription to server');
      }

      const result = await response.json();
      console.log('Subscription sent to server:', result);
      return result;
    } catch (error) {
      console.error('Error sending subscription to server:', error);
      throw error;
    }
  }

  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }

    return outputArray;
  }

  async showLocalNotification(title, options) {
    if (!await this.checkPermission()) {
      return;
    }

    if (Notification.permission === 'granted') {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, {
        body: options.body,
        icon: options.icon || '/favicon.png',
        badge: '/favicon.png',
        vibrate: [200, 100, 200],
        data: options.data || {},
        ...options,
      });
    }
  }
}

export default new NotificationHelper();
