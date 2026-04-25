
export class NotificationService {
  static async requestPermission() {
    if (!('Notification' in window)) {
      console.warn('Este navegador não suporta notificações.');
      return false;
    }

    if (Notification.permission === 'granted') return true;
    
    try {
      // modern promise-based
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch (error) {
      // fallback for older browsers
      return new Promise((resolve) => {
        Notification.requestPermission((permission) => {
          resolve(permission === 'granted');
        });
      });
    }
  }

  static isSupported() {
    return 'Notification' in window;
  }

  static getPermissionStatus() {
    if (!this.isSupported()) return 'unsupported';
    return Notification.permission;
  }

  static async showNotification(title: string, body: string) {
    if (Notification.permission !== 'granted') {
      const granted = await this.requestPermission();
      if (!granted) return;
    }

    const registration = await navigator.serviceWorker.ready;
    if (registration) {
      registration.showNotification(title, {
        body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'routine-reminder'
      });
    } else {
      new Notification(title, { body });
    }
  }
}
