// PWA Installation Helper

class PWAInstaller {
  constructor() {
    this.deferredPrompt = null;
    this.isInstalled = false;
    this.init();
  }

  async init() {
    // Check if app is already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      this.isInstalled = true;
      console.log('✅ App is running as standalone PWA');
    }

    // Listen for beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.showInstallPrompt();
    });

    // Listen for app installed event
    window.addEventListener('appinstalled', () => {
      console.log('✅ App installed successfully');
      this.isInstalled = true;
      this.hideInstallPrompt();
    });

    // Register service worker
    await this.registerServiceWorker();
  }

  async registerServiceWorker() {
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.register('/service-worker.js', {
          scope: '/'
        });
        console.log('✅ Service Worker registered:', registration);

        // Check for updates periodically
        setInterval(() => {
          registration.update();
        }, 60000); // Check every minute

        return registration;
      }
    } catch (error) {
      console.error('❌ Service Worker registration failed:', error);
    }
  }

  showInstallPrompt() {
    if (this.deferredPrompt && !this.isInstalled) {
      const installBanner = document.createElement('div');
      installBanner.id = 'install-banner';
      installBanner.innerHTML = `
        <div class="install-banner">
          <div class="install-content">
            <h3>📱 Install Secure Chat Hub</h3>
            <p>Install the app for a faster, native experience</p>
            <div class="install-buttons">
              <button id="installBtn" class="btn btn-primary">Install</button>
              <button id="dismissBtn" class="btn btn-secondary">Not now</button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(installBanner);

      document.getElementById('installBtn').addEventListener('click', () => {
        this.triggerInstall();
      });

      document.getElementById('dismissBtn').addEventListener('click', () => {
        this.hideInstallPrompt();
      });
    }
  }

  hideInstallPrompt() {
    const banner = document.getElementById('install-banner');
    if (banner) {
      banner.remove();
    }
  }

  async triggerInstall() {
    if (this.deferredPrompt) {
      this.deferredPrompt.prompt();
      const { outcome } = await this.deferredPrompt.userChoice;
      console.log(`User response to the install prompt: ${outcome}`);
      this.deferredPrompt = null;
    }
  }

  async checkForUpdates() {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.update();
        console.log('✅ Checked for updates');
      } catch (error) {
        console.error('Update check failed:', error);
      }
    }
  }

  isOnline() {
    return navigator.onLine;
  }

  setOnlineListener(callback) {
    window.addEventListener('online', () => {
      callback(true);
    });
    window.addEventListener('offline', () => {
      callback(false);
    });
  }
}

// Initialize PWA installer
const pwaInstaller = new PWAInstaller();
