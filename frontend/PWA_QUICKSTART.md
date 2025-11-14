# PWA Quick Start Guide

## Installation Steps

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Generate Icons

Open `public/icons/generate-icons.html` in your browser:

1. Click "Generate All Icons"
2. Click "Download All"
3. Move downloaded PNG files to `public/icons/` directory

Or use your own icon design tool to create icons in these sizes:
- 72x72, 96x96, 128x128, 144x144, 152x152
- 192x192, 384x384, 512x512
- Maskable: 192x192, 512x512

### 3. Build & Deploy

```bash
npm run build
```

The build output will be in `dist/` directory with:
- ✅ manifest.json
- ✅ sw.js (service worker)
- ✅ offline.html
- ✅ All icons
- ✅ Bundled app

### 4. Test Locally

```bash
npm run preview
```

Visit `http://localhost:5173` and:

1. Open DevTools (F12) → Application tab
2. Check "Manifest" section
3. Check "Service Workers" section
4. Verify icons are visible
5. Test offline mode (Network tab → Offline)

### 5. Verify PWA

Open `PWA_VERIFICATION.html` in your browser (after starting dev/preview server) to run comprehensive PWA checks.

## Testing Installation

### Desktop (Chrome/Edge)

1. Look for install icon (⊕) in address bar
2. Click to install
3. Or wait 3 seconds for install prompt

### Mobile (Android)

1. Open in Chrome
2. Tap "Add to Home screen" banner
3. Or Menu → "Add to Home screen"

### Mobile (iOS)

1. Open in Safari
2. Tap Share button
3. "Add to Home Screen"

## What You Get

- 📱 **Installable app** on desktop and mobile
- ⚡ **Fast loading** with service worker caching
- 🔌 **Offline support** with fallback page
- 🔄 **Auto-updates** with user notification
- 🎨 **App shortcuts** (right-click icon)
- 📲 **Push notifications** (optional)

## Files Created

```
frontend/
├── public/
│   ├── manifest.json                 # PWA manifest
│   ├── sw.js                        # Service worker
│   ├── offline.html                 # Offline fallback
│   ├── browserconfig.xml            # Microsoft config
│   └── icons/                       # All PWA icons
├── src/
│   ├── lib/pwa.ts                  # PWA manager
│   └── components/
│       ├── PWAInstallPrompt.tsx    # Install UI
│       └── PWAUpdateNotification.tsx # Update UI
├── PWA_GUIDE.md                     # Full documentation
├── PWA_QUICKSTART.md               # This file
└── PWA_VERIFICATION.html            # Testing tool
```

## HTML Meta Tags

All PWA meta tags have been added to `index.html`:
- ✅ Manifest link
- ✅ Theme colors
- ✅ Apple touch icons
- ✅ Microsoft tiles
- ✅ Open Graph tags
- ✅ Twitter cards

## Next Steps

1. **Customize** manifest.json with your app details
2. **Generate** icons matching your brand
3. **Test** on real devices
4. **Deploy** to production (HTTPS required!)
5. **Monitor** with Chrome DevTools Lighthouse

## Quick Commands

```bash
# Development
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Clear service worker cache
# Open DevTools → Application → Clear storage
```

## Troubleshooting

**App won't install?**
- Ensure HTTPS is enabled
- Check manifest.json is valid
- Verify icons exist

**Service worker not working?**
- Check browser console for errors
- Verify sw.js is in public directory
- Clear cache and retry

**Offline mode not working?**
- Check service worker is active
- Test in DevTools offline mode
- Verify offline.html exists

## Resources

- Full guide: `PWA_GUIDE.md`
- Verification tool: `PWA_VERIFICATION.html`
- Icon generator: `public/icons/generate-icons.html`

## Browser Support

| Browser | Install | Offline | Push | Sync |
|---------|---------|---------|------|------|
| Chrome  | ✅      | ✅      | ✅   | ✅   |
| Edge    | ✅      | ✅      | ✅   | ✅   |
| Safari  | iOS only| ✅      | ✅   | ❌   |
| Firefox | ❌      | ✅      | ✅   | ❌   |

## Success Checklist

- [ ] Dependencies installed
- [ ] Icons generated (all sizes)
- [ ] App builds successfully
- [ ] Manifest validates in DevTools
- [ ] Service worker registers
- [ ] Offline mode works
- [ ] Install prompt appears
- [ ] App installs on desktop
- [ ] App installs on mobile
- [ ] Lighthouse PWA score > 90

---

**Need help?** See `PWA_GUIDE.md` for comprehensive documentation.
