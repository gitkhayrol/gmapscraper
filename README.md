<div align="center">

<img src="icons/icon128.png" width="90" alt="GMapScraper Pro Logo">

# GMapScraper Pro

**Powerful Google Maps Business Data Extractor**

[![Version](https://img.shields.io/badge/version-1.1-00e5ff?style=flat-square)](https://github.com/gitkhayrol/gmapscraper)
[![Manifest](https://img.shields.io/badge/manifest-v3-7c3aed?style=flat-square)](https://developer.chrome.com/docs/extensions/mv3/)
[![License](https://img.shields.io/badge/license-MIT-10b981?style=flat-square)](LICENSE)
[![Made by](https://img.shields.io/badge/made%20by-Khayrol%20Islam-f59e0b?style=flat-square)](https://github.com/gitkhayrol)

Scrape business names, phones, emails, addresses, ratings, websites and more from Google Maps — with a built-in web portal to control everything from your browser.

[📦 Install](#-installation) · [🚀 Quick Start](#-quick-start) · [🌐 Web Portal](#-web-portal) · [📊 Export](#-export) · [⚙️ Settings](#%EF%B8%8F-settings)

---

</div>

## 📸 Screenshots

> **Add your screenshots here.**
> Replace the placeholder blocks below with your own images.

<table>
<tr>
<td align="center" width="50%">

**Extension Popup — Scrape Tab**

<!-- Replace with your screenshot:
![Scrape Tab](docs/screenshot-scrape.png)
-->

```
[ Drop your screenshot here ]
```

</td>
<td align="center" width="50%">

**Extension Popup — Results Tab**

<!-- Replace with your screenshot:
![Results Tab](docs/screenshot-results.png)
-->

```
[ Drop your screenshot here ]
```

</td>
</tr>
<tr>
<td align="center" width="50%">

**Web Control Portal — Dashboard**

<!-- Replace with your screenshot:
![Portal Dashboard](docs/screenshot-portal.png)
-->

```
[ Drop your screenshot here ]
```

</td>
<td align="center" width="50%">

**Exported CSV Data**

<!-- Replace with your screenshot:
![CSV Export](docs/screenshot-export.png)
-->

```
[ Drop your screenshot here ]
```

</td>
</tr>
</table>

---

## 🎬 Demo Video

> **Add your demo video here.**
> Upload to YouTube, then replace the link below.

<!--
[![Watch Demo](https://img.youtube.com/vi/YOUR_VIDEO_ID/maxresdefault.jpg)](https://www.youtube.com/watch?v=YOUR_VIDEO_ID)
-->

```
[ Drop your demo video thumbnail + link here ]
```

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🗺️ **90+ Categories** | Restaurant, Hospital, School, Hotel, Bank, Gym — searchable dropdown |
| 📋 **Rich Data** | Name, phone, email, website, address, city, rating, reviews, hours, coordinates |
| 📧 **Email Finder** | After scraping, visits each website and extracts real emails & phone numbers |
| 🌐 **Web Portal** | Control everything from `http://127.0.0.1:5590` — no popup needed |
| 💾 **4 Export Formats** | CSV, JSON, Excel (TSV), TXT — choose which fields to include |
| ⚡ **Fast** | Concurrent enrichment (5 parallel fetches), smart delay tuning |
| 🔁 **Auto Dedup** | Prevents duplicate records using URL path + name + phone matching |
| 🔒 **Auth Portal** | Username/password login for the web portal |
| 📡 **Real-time Sync** | Extension ↔ portal via WebSocket — live progress, live table |

---

## 📦 Installation

### Chrome / Edge (Load Unpacked)

1. Download or clone this repository
   ```bash
   git clone https://github.com/gitkhayrol/gmapscraper.git
   ```

2. Open Chrome and go to `chrome://extensions/`

3. Enable **Developer Mode** (toggle in top-right corner)

4. Click **"Load unpacked"** and select the `gmapscraper` folder

5. The 🗺️ icon appears in your toolbar — pin it!

> **Note:** The extension requires Google Chrome 90+ or any Chromium-based browser with extension support.

---

## 🚀 Quick Start

### Using the Extension Popup

1. Click the 🗺️ icon in your toolbar
2. **Scrape tab** → pick a category + enter a location
3. Click **"🗺️ Open Google Maps"** — a Maps tab opens
4. Click **"▶ Start Scraping"** — the scraper runs automatically
5. Switch to the **Results tab** to see live data
6. Switch to the **Export tab** to download your data

### Using the Web Portal

```bash
cd gmapscraper/server
npm install
node server.js
```

Open `http://127.0.0.1:5590` — login with `admin` / `admin123`

---

## 📊 Collected Data Fields

| Field | Description |
|-------|-------------|
| Business Name | Full name of the business |
| Category | Business type (Plumber, Restaurant, etc.) |
| Phone | Primary phone number |
| Email | Email from Maps or scraped from website |
| Website | Business website URL |
| Address | Full street address |
| City | City extracted from address |
| State | State / Province |
| Country | Country |
| ZIP / Postal | Postal code |
| Latitude | GPS latitude (from JSON-LD or URL) |
| Longitude | GPS longitude |
| Rating | Star rating (e.g. 4.8) |
| Reviews | Number of reviews (e.g. 1,072) |
| Open Hours | Current hours (e.g. Open 24 hours) |
| Plus Code | Google Plus Code |
| Scraped At | ISO timestamp of when the record was collected |

---

## 📧 Find Emails from Websites

After scraping, use the **"🔍 Find Emails & Phones from Websites"** button (Results tab):

- Visits each business website automatically
- Extracts emails in priority order:
  1. `mailto:` links (most reliable)
  2. JSON-LD / schema.org `"email"` property
  3. General scan — prefers `contact@`, `info@`, `sales@`
- Extracts phones in priority order:
  1. `<a href="tel:...">` links
  2. JSON-LD `"telephone"` property
  3. Text near "phone:", "tel:", "WhatsApp:" keywords
- Runs **5 fetches in parallel** — fast even for 100+ records
- Skips obvious false positives (tracking pixels, CDN domains, etc.)

---

## 🌐 Web Portal

The web portal lets you control the extension from any browser tab — useful when you want to keep Google Maps in the foreground.

### Setup

```bash
cd server
npm install       # installs express, ws, express-session
node server.js    # starts on http://127.0.0.1:5590
```

### Default Credentials

| Field | Value |
|-------|-------|
| URL | `http://127.0.0.1:5590` |
| Username | `admin` |
| Password | `admin123` |

> Change credentials in [`server/server.js` line 11–12](server/server.js).

### Portal Features

- **Live dashboard** — real-time stats and results table
- **Full scrape control** — category, location, radius, max results, start/stop
- **Post-processing** — enrich emails & phones button
- **Export** — CSV / JSON / Excel / TXT download right from the browser
- **Extension status** — shows if extension is connected or offline
- **Secure** — session cookie auth, 24-hour expiry

### Architecture

```
Your Browser (127.0.0.1:5590)
        ↕ WebSocket
  Node.js Server (Express + ws)
        ↕ WebSocket
  Chrome Extension (background.js)
        ↕ chrome.scripting
  Google Maps Tab (content.js)
```

---

## 💾 Export

From the **Export tab** (popup) or **portal dashboard**:

| Format | Best For |
|--------|----------|
| **CSV** | Excel, Google Sheets |
| **JSON** | APIs, databases, developers |
| **Excel** | Native Excel open (TSV format) |
| **TXT** | Plain text, human readable |

Choose exactly which fields to include before exporting.

---

## ⚙️ Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Scroll Delay | 600ms | Time between sidebar scrolls. Increase if Google shows CAPTCHAs |
| Click Delay | 350ms | Time to wait after clicking a listing |
| Max Retries | 5 | Consecutive failed scrolls before stopping |

---

## 📁 File Structure

```
gmapscraper/
├── manifest.json           # Extension config (MV3)
├── popup.html              # Extension popup UI
├── src/
│   ├── popup.js            # Popup controller — tabs, scrape, export, enrich
│   ├── content.js          # Maps page scraper — clicks listings, extracts data
│   └── background.js       # Service worker — badge, fetch proxy, portal WS client
├── server/
│   ├── server.js           # Node.js portal server (Express + WebSocket)
│   ├── package.json
│   └── public/
│       ├── login.html      # Portal login page
│       └── dashboard.html  # Portal control panel
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## ⚠️ Important Notes

- **Respect Google's Terms of Service** — use for research and educational purposes
- Increase the **Scroll Delay** in Settings if Google shows CAPTCHAs or rate-limits you
- Results depend entirely on what Google Maps shows publicly
- Email enrichment requires visiting external websites — use responsibly
- The portal server runs **locally only** (`127.0.0.1`) — it is not exposed to the internet

---

## 🛠️ Requirements

| Component | Requirement |
|-----------|-------------|
| Browser | Chrome 90+ / Edge 90+ (Chromium-based) |
| Node.js | v16+ (for web portal only) |
| OS | Windows, macOS, Linux |

---

## 👤 Author

**Khayrol Islam**

- GitHub: [@gitkhayrol](https://github.com/gitkhayrol)
- Facebook: [khayrol.islam.35](https://www.facebook.com/khayrol.islam.35)

---

## 📄 License

MIT License — free to use, modify, and distribute with attribution.

---

<div align="center">

Made with ❤️ by **Khayrol Islam**

⭐ Star this repo if it helped you!

</div>
