class NotificationManager {
  constructor() {
    this.isSupported = 'Notification' in window && 'serviceWorker' in navigator;
    this.permissionGranted = false;
    this.init();
  }

  async init() {
    if (!this.isSupported) {
      console.warn('Notifications not supported');
      return;
    }

    // Check current permission
    if (Notification.permission === 'granted') {
      this.permissionGranted = true;
    } else if (Notification.permission !== 'denied') {
      // Request permission if not already denied
      this.requestPermission();
    }
  }

  async requestPermission() {
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        this.permissionGranted = true;
        this.subscribeToNotifications();
      }
    } catch (error) {
      console.error('Permission request failed:', error);
    }
  }

  async subscribeToNotifications() {
    try {
      const registration = await navigator.serviceWorker.ready;
      
      // Check if push messaging is supported
      if (!registration.pushManager) {
        console.warn('Push notifications not supported');
        return;
      }

      // Get existing subscription or create new one
      let subscription = await registration.pushManager.getSubscription();
      
      if (!subscription) {
        // Generate VAPID key (for production use a real one)
        const vapidPublicKey = 'BElmZWFrb3dTQQ==';
        
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this.urlBase64ToUint8Array(vapidPublicKey)
        });
      }

      // Send subscription to server
      await this.sendSubscriptionToServer(subscription);
    } catch (error) {
      console.error('Push subscription failed:', error);
    }
  }

  async sendSubscriptionToServer(subscription) {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(subscription)
      });

      if (response.ok) {
        console.log('✅ Push subscription saved');
      }
    } catch (error) {
      console.error('Failed to send subscription to server:', error);
    }
  }

  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  showLocalNotification(title, options = {}) {
    if (!this.permissionGranted) {
      console.warn('Notifications not permitted');
      return;
    }

    const defaultOptions = {
      icon: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 192 192%22><rect fill=%22%232563eb%22 width=%22192%22 height=%22192%22/><text x=%2250%25%22 y=%2250%25%22 font-size=%2280%22 font-weight=%22bold%22 text-anchor=%22middle%22 dominant-baseline=%22middle%22 fill=%22white%22>🔐</text></svg>',
      badge: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 192 192%22><rect fill=%22%232563eb%22 width=%22192%22 height=%22192%22/><text x=%2250%25%22 y=%2250%25%22 font-size=%2280%22 font-weight=%22bold%22 text-anchor=%22middle%22 dominant-baseline=%22middle%22 fill=%22white%22>🔐</text></svg>',
      tag: 'secure-chat-notification',
      requireInteraction: false,
      ...options
    };

    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SHOW_NOTIFICATION',
        title,
        options: defaultOptions
      });
    } else {
      new Notification(title, defaultOptions);
    }
  }

  requestBadgePermission() {
    if ('setAppBadge' in navigator) {
      navigator.setAppBadge(1).catch((error) => {
        console.log('Badge permission:', error);
      });
    }
  }

  clearBadge() {
    if ('clearAppBadge' in navigator) {
      navigator.clearAppBadge().catch((error) => {
        console.log('Clear badge error:', error);
      });
    }
  }

  setBadgeCount(count) {
    if ('setAppBadge' in navigator) {
      if (count > 0) {
        navigator.setAppBadge(count).catch((error) => {
          console.log('Set badge error:', error);
        });
      } else {
        this.clearBadge();
      }
    }
  }
}

// Initialize notification manager
const notificationManager = new NotificationManager();
