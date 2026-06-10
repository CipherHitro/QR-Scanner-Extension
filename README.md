# QR Scanner Extension

A lightweight Chrome/Edge extension that scans QR codes from any visible area of a webpage, image, PDF viewer, Gmail, WhatsApp Web, or other web app.

The extension works locally in the browser. It does not use any paid API, backend server, analytics service, or external runtime request for scanning.

## Features

- Click the extension icon to instantly activate area selection
- Drag over any visible QR code on the page
- Works with rendered pixels, so it can scan PDFs, images, iframes, and web apps
- Decodes QR codes locally with bundled `jsQR`
- Copies decoded text to clipboard
- Opens decoded links in a new browser tab
- No build step, framework, or server required

## Repository

```bash
git clone git@github.com:CipherHitro/QR-Scanner-Extension.git
cd QR-Scanner-Extension
```

HTTPS clone:

```bash
git clone https://github.com/CipherHitro/QR-Scanner-Extension.git
cd QR-Scanner-Extension
```

## Install Locally

1. Open Chrome or Edge.
2. Go to `chrome://extensions` or `edge://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select this project folder.
6. Pin the extension to your browser toolbar.
7. Click the extension icon and drag over a QR code.

For local PDF/image files opened with `file://`, enable **Allow access to file URLs** from the extension details page.

## Project Files

```text
.
├── manifest.json
├── background.js
├── content.js
├── content.css
├── jsqr.js
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## How It Works

1. The user clicks the extension icon.
2. The background service worker injects the scanner UI into the active tab.
3. The user selects an area containing a QR code.
4. The extension captures the visible tab with `chrome.tabs.captureVisibleTab`.
5. The selected area is cropped with Canvas.
6. The bundled `jsQR` library decodes the cropped image data locally.
7. The decoded result is shown, copied, and can be opened if it is a link.

## Privacy

This extension does not collect, store, sell, or transmit user data.

QR scanning is performed locally in the browser. The selected screenshot area is processed in memory and is not uploaded anywhere.

## Permissions

- `activeTab`: access the current tab after the user clicks the extension
- `scripting`: inject the selection overlay and scanner logic
- `tabs`: capture the visible tab and open decoded links
- `clipboardWrite`: copy decoded QR text to the clipboard
- `<all_urls>`: allow scanning on normal sites, web apps, images, and PDFs

## License

Personal-use license.

You may clone, inspect, modify, and use this project locally for personal or learning purposes. You may not republish, redistribute, sell, or submit this project to any browser extension store as your own work without permission.

Created by Rohit.
