# Progressive Web App (PWA) Implementation Guide

## Overview

Stock Whisperer is now a fully-featured Progressive Web App that can be installed on desktop and mobile devices. This guide covers all aspects of the PWA implementation.

## Features

### Core PWA Features

- ✅ **Installable**: Add to home screen on any device
- ✅ **Offline Support**: Works without internet connection
- ✅ **Fast Loading**: Service worker caching for instant loads
- ✅ **App-like Experience**: Standalone display mode
- ✅ **Auto-updates**: Automatic updates with user notification
- ✅ **Push Notifications**: Support for web push notifications
- ✅ **Background Sync**: Sync data when connection restored
- ✅ **Responsive**: Works on all screen sizes

### Technical Features

- Service Worker with multiple caching strategies
- Web App Manifest with proper metadata
- Install prompts and update notifications
- Offline fallback page
- Icon generation in all required sizes
- iOS and Android compatibility
- Microsoft PWA support

## File Structure

```
frontend/
├── public/
│   ├── manifest.json              # PWA manifest
│   ├── sw.js                      # Service worker
│   ├── offline.html               # Offline fallback page
│   ├── browserconfig.xml          # Microsoft config
│   ├── icons/                     # PWA icons
│   │   ├── icon-72x72.png
│   │   ├── icon-96x96.png
│   │   ├── icon-128x128.png
│   │   ├── icon-144x144.png
│   │   ├── icon-152x152.png
│   │   ├── icon-192x192.png
│   │   ├── icon-384x384.png
│   │   ├── icon-512x512.png
│   │   ├── icon-maskable-192x192.png
│   │   ├── icon-maskable-512x512.png
│   │   ├── shortcut-watchlist.png
│   │   ├── shortcut-charts.png
│   │   ├── shortcut-news.png
│   │   └── generate-icons.html   # Icon generator tool
│   └── screenshots/               # App screenshots
├── src/
│   ├── lib/
│   │   └── pwa.ts                # PWA manager utility
│   └── components/
│       ├── PWAInstallPrompt.tsx  # Install UI
│       └── PWAUpdateNotification.tsx  # Update UI
└── index.html                     # Updated with PWA meta tags
```

## Installation

### For Users

#### Desktop (Chrome, Edge, Brave)

1. Visit Stock Whisperer in your browser
2. Look for the install icon in the address bar (⊕)
3. Click "Install Stock Whisperer"
4. Or click the install prompt that appears after 3 seconds

#### Desktop (Safari)

Safari doesn't support PWA installation on desktop, but the app works fully in the browser.

#### Mobile (Android)

1. Open Stock Whisperer in Chrome
2. Tap the menu (⋮) → "Add to Home screen"
3. Or tap "Install" when the banner appears
4. App appears on home screen

#### Mobile (iOS)

1. Open Stock Whisperer in Safari
2. Tap the share button (□↑)
3. Scroll down and tap "Add to Home Screen"
4. Tap "Add" to confirm

### For Developers

The PWA is automatically configured when you run the development server:

```bash
npm run dev
```

To test PWA features in production mode:

```bash
npm run build
npm run preview
```

## PWA Manifest

Location: `public/manifest.json`

### Key Settings

```json
{
  "name": "Stock Whisperer - Trading Platform",
  "short_name": "Stock Whisperer",
  "theme_color": "#0f172a",
  "background_color": "#0f172a",
  "display": "standalone",
  "orientation": "any"
}
```

### Display Modes

- **standalone**: Looks like a native app (no browser UI)
- **minimal-ui**: Shows minimal browser controls
- **fullscreen**: No browser UI at all (not recommended)
- **browser**: Regular browser experience

### Orientation Settings

- **any**: Allow all orientations (default)
- **portrait**: Lock to portrait mode
- **landscape**: Lock to landscape mode

## Service Worker

Location: `public/sw.js`

### Caching Strategies

#### 1. Cache-First (Static Assets)

Used for: JavaScript, CSS, fonts, images

```javascript
// Check cache first, fallback to network
const response = await caches.match(request);
if (response) return response;
return fetch(request);
```

#### 2. Network-First (API Requests)

Used for: Stock data, news, real-time quotes

```javascript
// Try network first, fallback to cache
try {
  const response = await fetch(request);
  cache.put(request, response.clone());
  return response;
} catch {
  return caches.match(request);
}
```

#### 3. Stale-While-Revalidate (Optional)

```javascript
// Return cached version, update in background
const cached = await caches.match(request);
const fetchPromise = fetch(request).then(updateCache);
return cached || fetchPromise;
```

### Cache Names

```javascript
const CACHE_NAME = 'stock-whisperer-v1.0.0';
const RUNTIME_CACHE = 'stock-whisperer-runtime';
const IMAGE_CACHE = 'stock-whisperer-images';
```

### Precached Files

```javascript
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];
```

## PWA Manager API

Location: `src/lib/pwa.ts`

### Usage

```typescript
import { pwaManager } from './lib/pwa';

// Register service worker
await pwaManager.register();

// Check if app can be installed
if (pwaManager.canInstall()) {
  await pwaManager.install();
}

// Check if already installed
if (pwaManager.isInstalled()) {
  console.log('App is installed');
}

// Check for updates
await pwaManager.checkForUpdates();

// Install pending update
await pwaManager.skipWaiting();

// Clear all caches
await pwaManager.clearCache();

// Get service worker version
const version = await pwaManager.getVersion();

// Check online status
const isOnline = pwaManager.isOnline();

// Listen for updates
const unsubscribe = pwaManager.onUpdate((event) => {
  if (event.type === 'update-available') {
    console.log('New version available!');
  }
});

// Request notification permission
await pwaManager.requestNotificationPermission();

// Show notification
await pwaManager.showNotification('Hello!', {
  body: 'This is a notification',
  icon: '/icons/icon-192x192.png'
});

// Enable background sync
await pwaManager.enableBackgroundSync('sync-data');

// Get connection info
const info = pwaManager.getConnectionInfo();
```

### Components

#### PWAInstallPrompt

Automatically shows install prompt after 3 seconds if:
- App is not installed
- Browser supports installation
- User hasn't dismissed the prompt

```tsx
import { PWAInstallPrompt } from './components/PWAInstallPrompt';

<PWAInstallPrompt />
```

#### PWAUpdateNotification

Shows notification when new version is available:

```tsx
import { PWAUpdateNotification } from './components/PWAUpdateNotification';

<PWAUpdateNotification />
```

## Icon Generation

### Using the Icon Generator

1. Open `public/icons/generate-icons.html` in a browser
2. Click "Generate All Icons"
3. Review the previews
4. Click "Download All" to save icons
5. Icons are saved to your downloads folder
6. Move them to `public/icons/`

### Required Icon Sizes

- **72x72**: Favicon, small icons
- **96x96**: Desktop favicon
- **128x128**: Small devices
- **144x144**: Microsoft tile
- **152x152**: iOS touch icon
- **192x192**: Standard PWA icon (Android)
- **384x384**: Large icon
- **512x512**: Splash screens, high-res displays
- **Maskable 192x192**: Android adaptive icon
- **Maskable 512x512**: Android adaptive icon

### Maskable Icons

Maskable icons have 20% safe zone padding to support Android's adaptive icons.

```json
{
  "src": "/icons/icon-maskable-512x512.png",
  "sizes": "512x512",
  "type": "image/png",
  "purpose": "maskable"
}
```

## App Shortcuts

Location: `manifest.json` → `shortcuts`

Desktop users can right-click the app icon for quick actions:

```json
{
  "shortcuts": [
    {
      "name": "Watchlist",
      "url": "/?view=watchlist",
      "icons": [{ "src": "/icons/shortcut-watchlist.png", "sizes": "192x192" }]
    }
  ]
}
```

## Offline Support

### Offline Page

Location: `public/offline.html`

Shown when:
- User is offline
- Requested page isn't cached
- Network request fails

Features:
- Branded design matching app
- Connection status check
- Auto-redirect when online
- Feature list for context

### Testing Offline Mode

1. Open DevTools (F12)
2. Go to Network tab
3. Change throttling to "Offline"
4. Reload page
5. Verify offline page appears

Or use Application tab → Service Workers → Offline checkbox

## Push Notifications

### Request Permission

```typescript
const permission = await pwaManager.requestNotificationPermission();

if (permission === 'granted') {
  await pwaManager.showNotification('Welcome!', {
    body: 'Notifications are enabled',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [200, 100, 200]
  });
}
```

### Send from Service Worker

```javascript
self.addEventListener('push', (event) => {
  const data = event.data.json();

  self.registration.showNotification(data.title, {
    body: data.body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    tag: 'stock-alert',
    requireInteraction: true
  });
});
```

### Handle Click

```javascript
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.openWindow('/')
  );
});
```

## Background Sync

Sync data when connection is restored:

```typescript
// Register sync
await pwaManager.enableBackgroundSync('sync-data');

// Service worker handles sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-data') {
    event.waitUntil(syncData());
  }
});
```

## Testing PWA

### Chrome DevTools

1. Open DevTools (F12)
2. Go to Application tab
3. Check sections:
   - **Manifest**: Verify manifest is valid
   - **Service Workers**: Check registration
   - **Storage**: View caches
   - **Clear storage**: Reset PWA state

### Lighthouse Audit

1. Open DevTools (F12)
2. Go to Lighthouse tab
3. Select "Progressive Web App"
4. Click "Generate report"
5. Review checklist:
   - ✅ Installable
   - ✅ PWA optimized
   - ✅ Fast and reliable
   - ✅ Works offline

### Manual Testing

- [ ] Install app on desktop
- [ ] Install app on mobile
- [ ] Test offline mode
- [ ] Verify icons appear correctly
- [ ] Check app shortcuts work
- [ ] Test update notification
- [ ] Verify caching works
- [ ] Test on different browsers

### Browser Compatibility

| Feature | Chrome | Edge | Safari | Firefox |
|---------|--------|------|--------|---------|
| Install | ✅ | ✅ | iOS only | ❌ |
| Service Worker | ✅ | ✅ | ✅ | ✅ |
| Offline | ✅ | ✅ | ✅ | ✅ |
| Push | ✅ | ✅ | ✅ | ✅ |
| Background Sync | ✅ | ✅ | ❌ | ❌ |

## Updating the PWA

### Version Updates

1. Update `CACHE_NAME` in `sw.js`:

```javascript
const CACHE_NAME = 'stock-whisperer-v1.1.0';
```

2. Build and deploy:

```bash
npm run build
```

3. Service worker auto-updates
4. Users see update notification
5. Click "Update Now" to reload

### Force Update

Clear all caches and reload:

```typescript
await pwaManager.clearCache();
window.location.reload();
```

## Troubleshooting

### Issue: App won't install

**Solutions:**
- Check manifest.json is valid (DevTools → Application)
- Verify HTTPS is enabled (required for PWA)
- Ensure icons are accessible
- Check browser supports installation

### Issue: Service worker not registering

**Solutions:**
- Check browser console for errors
- Verify sw.js is in public directory
- Check scope is correct
- Clear browser cache and retry

### Issue: Offline mode not working

**Solutions:**
- Check service worker is active
- Verify offline.html exists
- Check cache strategy in sw.js
- Test in DevTools offline mode

### Issue: Updates not appearing

**Solutions:**
- Check cache version changed
- Verify service worker updated
- Clear browser cache
- Hard reload (Ctrl+Shift+R)

### Issue: Icons not showing

**Solutions:**
- Verify icon files exist in public/icons
- Check file paths in manifest.json
- Generate icons using provided tool
- Check image format is PNG

## Best Practices

### DO

- ✅ Version your caches
- ✅ Provide offline fallback
- ✅ Test on real devices
- ✅ Optimize icon sizes
- ✅ Use HTTPS
- ✅ Handle update notifications gracefully
- ✅ Cache critical resources
- ✅ Test offline functionality

### DON'T

- ❌ Cache too much (manage cache size)
- ❌ Skip service worker updates
- ❌ Ignore browser compatibility
- ❌ Forget to test on mobile
- ❌ Use HTTP (HTTPS required)
- ❌ Cache user-specific data without care
- ❌ Ignore error handling

## Performance

### Cache Size Management

```javascript
// Limit cache entries
const MAX_CACHE_SIZE = 100;

async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();

  if (keys.length > maxItems) {
    await cache.delete(keys[0]);
    await trimCache(cacheName, maxItems);
  }
}
```

### Cache Expiration

```javascript
// Check if cached response is expired
function isCacheExpired(response, maxAge) {
  const date = new Date(response.headers.get('date'));
  const age = Date.now() - date.getTime();
  return age > maxAge;
}
```

## Deployment

### Build for Production

```bash
npm run build
```

### Deploy Checklist

- [ ] Update version in sw.js
- [ ] Generate all icons
- [ ] Test on staging environment
- [ ] Run Lighthouse audit
- [ ] Test offline mode
- [ ] Verify HTTPS enabled
- [ ] Test on multiple devices
- [ ] Check manifest is valid
- [ ] Deploy to production

## Resources

- [MDN: Progressive Web Apps](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
- [Web.dev: PWA Checklist](https://web.dev/pwa-checklist/)
- [Google: Workbox](https://developers.google.com/web/tools/workbox)
- [PWA Builder](https://www.pwabuilder.com/)
- [Can I Use: Service Workers](https://caniuse.com/serviceworkers)

## Support

For issues related to PWA functionality:

1. Check browser console for errors
2. Review DevTools Application tab
3. Run Lighthouse audit
4. Check this documentation
5. Test on different browser/device

## Changelog

### Version 1.0.0
- Initial PWA implementation
- Service worker with caching
- Install prompts
- Update notifications
- Offline support
- Icon generation tool
- Comprehensive documentation
