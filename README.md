<div align="center">

<img src="https://raw.githubusercontent.com/gitkhayrol/gmapscraper/refs/heads/main/exm_image/image.png" width="100%" alt="GMapScraper Pro Banner">

<br/>

# 🗺️ GMapScraper Pro

<p>
  <img src="https://img.shields.io/badge/version-1.1-00e5ff?style=for-the-badge&logo=googlemaps&logoColor=white" />
  <img src="https://img.shields.io/badge/Chrome-Extension-7c3aed?style=for-the-badge&logo=googlechrome&logoColor=white" />
  <img src="https://img.shields.io/badge/Manifest-v3-10b981?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Node.js-Portal-f59e0b?style=for-the-badge&logo=nodedotjs&logoColor=white" />
  <img src="https://img.shields.io/badge/license-MIT-ef4444?style=for-the-badge" />
</p>

**Extract business names, phones, emails, addresses, ratings & more from Google Maps.**
Includes a real-time **Web Control Portal** — scrape, enrich, and export without ever touching the popup.

<br/>

[📦 Install](#-installation) &nbsp;·&nbsp; [🚀 Quick Start](#-quick-start) &nbsp;·&nbsp; [🌐 Web Portal](#-web-portal) &nbsp;·&nbsp; [📧 Email Finder](#-email--phone-finder) &nbsp;·&nbsp; [💾 Export](#-export)

<br/>

</div>

---

## 🎬 Demo

<div align="center">

<a href="https://raw.githubusercontent.com/gitkhayrol/gmapscraper/refs/heads/main/exm_image/video.mp4">
  <img src="https://raw.githubusercontent.com/gitkhayrol/gmapscraper/refs/heads/main/exm_image/image2.png" width="100%" alt="▶ Click to watch demo video" title="▶ Click to watch demo video" />
</a>

▶ **[Click to watch full demo video](https://raw.githubusercontent.com/gitkhayrol/gmapscraper/refs/heads/main/exm_image/video.mp4)**

</div>

---

## 📸 Screenshots

<div align="center">

<table>
<tr>
<td width="50%">

<img src="https://raw.githubusercontent.com/gitkhayrol/gmapscraper/refs/heads/main/exm_image/image3.png" width="100%" alt="Extension Popup — Scrape Tab" />

**Extension Popup**

</td>
<td width="50%">

<img src="https://raw.githubusercontent.com/gitkhayrol/gmapscraper/refs/heads/main/exm_image/imag4.png" width="100%" alt="Web Control Portal" />

**Web Control Portal**

</td>
</tr>
</table>

</div>

---

## ✨ Features

<div align="center">

| | Feature | Description |
|--|---------|-------------|
| 🗺️ | **90+ Categories** | Restaurant, Hospital, School, Hotel, Bank, Gym + custom keyword |
| 📋 | **Rich Data** | Name · Phone · Email · Website · Address · Rating · Reviews · Hours · GPS |
| 📧 | **Email Finder** | Visits each website and extracts real contact emails & phone numbers |
| 🌐 | **Web Portal** | Full control panel at `http://127.0.0.1:5590` — no popup needed |
| 💾 | **4 Export Formats** | CSV · JSON · Excel · TXT — choose exactly which fields |
| ⚡ | **Fast** | 5 concurrent enrichment fetches, human-like timing with jitter |
| 🔁 | **Auto Dedup** | URL path + name + phone matching — zero duplicates |
| 📡 | **Real-time Sync** | Extension ↔ Portal via WebSocket — live counter & results table |
| 🔒 | **Auth** | Login-protected web portal with 24-hour session |

</div>

---

## 📦 Installation

### Chrome / Edge

```
1. Clone or download this repository
2. Open  chrome://extensions/
3. Enable Developer Mode  (top-right toggle)
4. Click "Load unpacked"  →  select the gmapscraper folder
5. Pin the 🗺️ icon to your toolbar
```

> Requires **Chrome 90+** or any Chromium-based browser.

---

## 🚀 Quick Start

### Option A — Extension Popup

| Step | Action |
|------|--------|
| 1 | Click the 🗺️ toolbar icon |
| 2 | Pick a **Category** + enter a **Location** |
| 3 | Click **"Open Google Maps"** |
| 4 | Click **"▶ Start Scraping"** |
| 5 | Watch the live counter — switch to **Results** tab |
| 6 | Go to **Export** tab → download your data |

### Option B — Web Portal

```bash
cd gmapscraper/server
npm install
node server.js
```

Open **`http://127.0.0.1:5590`** — login: `admin` / `admin123`

---

## 📊 Collected Data Fields

<div align="center">

| Field | Field | Field |
|-------|-------|-------|
| ✅ Business Name | ✅ Phone | ✅ Email |
| ✅ Category | ✅ Website | ✅ Full Address |
| ✅ City | ✅ State | ✅ Country |
| ✅ ZIP / Postal | ✅ Latitude | ✅ Longitude |
| ✅ Star Rating | ✅ Review Count | ✅ Open Hours |
| ✅ Plus Code | ✅ Scraped At | |

</div>

---

## 📧 Email & Phone Finder

After scraping, click **"🔍 Find Emails & Phones from Websites"** in the Results tab.

```
For each record that has a website URL:

  1. Fetch the website HTML  (300 KB cap, 5s timeout)
  2. Extract email  →  mailto: link  →  JSON-LD  →  regex scan
  3. Extract phone  →  tel: link    →  JSON-LD  →  keyword context
  4. Update the record in-place

Runs 5 websites in parallel  →  ~5× faster than serial
```

**Email priority**
1. `href="mailto:..."` links — most explicit
2. `"email": "..."` in JSON-LD / schema.org
3. Regex scan — prefers `contact@`, `info@`, `sales@`

**Phone priority**
1. `href="tel:..."` links
2. `"telephone": "..."` in JSON-LD
3. Text near "phone:", "tel:", "WhatsApp:" keywords

---

## 🌐 Web Portal

<div align="center">

```
┌─────────────────────────────────────────────────────┐
│              GMapScraper Pro  PORTAL                │
├──────────────────────┬──────────────────────────────┤
│  CONTROLS            │  LIVE RESULTS TABLE          │
│  ─────────────────   │  ─────────────────────────   │
│  Category  [select]  │  #  Name  Phone  Email  ★    │
│  Location  [input ]  │  1  ...   ...    ...    4.8  │
│  Radius    [slider]  │  2  ...   ...    ...    5.0  │
│  Max       [select]  │  3  ...   ...    ...    4.6  │
│                      │  ...                         │
│  [▶ Start]  [■ Stop] │                              │
│  [🔍 Find Emails]    │  [CSV] [JSON] [Excel] [TXT]  │
└──────────────────────┴──────────────────────────────┘
```

</div>

### Setup

```bash
cd server && npm install && node server.js
```

### Default Login

| | |
|--|--|
| URL | `http://127.0.0.1:5590` |
| Username | `admin` |
| Password | `admin123` |

> Change in [`server/server.js`](server/server.js) lines 11–12

### Architecture

```
Browser @ 127.0.0.1:5590
       ↕  WebSocket
  Node.js Server  (Express + ws)
       ↕  WebSocket
  Chrome Extension  (background.js)
       ↕  chrome.scripting
  Google Maps Tab  (content.js)
```

---

## 💾 Export

<div align="center">

| Format | Use Case |
|--------|----------|
| 📄 **CSV** | Excel, Google Sheets, any spreadsheet |
| **{ }** **JSON** | APIs, databases, developers |
| 📊 **Excel** | Native Excel open (TSV) |
| 📝 **TXT** | Plain text, human readable |

</div>

Select only the fields you need before exporting. All 17 fields are checked by default.

---

## ⚙️ Settings

| Setting | Default | Notes |
|---------|---------|-------|
| Scroll Delay | `600ms` | Increase to `1200ms` if CAPTCHAs appear |
| Click Delay | `350ms` | Minimum `150ms` recommended |
| Max Retries | `5` | Consecutive failed scrolls before stopping |

---

## 📁 Project Structure

```
gmapscraper/
├── manifest.json              Chrome MV3 config
├── popup.html                 Extension popup UI
├── src/
│   ├── popup.js               Popup: tabs, scrape, enrich, export
│   ├── content.js             Maps tab: click listings, extract data
│   └── background.js          Service worker: badge, fetch proxy, portal WS
├── server/
│   ├── server.js              Express + WebSocket portal server
│   ├── package.json
│   └── public/
│       ├── login.html         Portal login
│       └── dashboard.html     Portal dashboard
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## ⚠️ Notes

- Use for **research and educational purposes** only
- Respect [Google's Terms of Service](https://policies.google.com/terms)
- The portal runs on `127.0.0.1` only — not exposed to the internet
- Increase delays in Settings if you encounter CAPTCHAs

---

## 🛠️ Requirements

| Component | Requirement |
|-----------|-------------|
| Browser | Chrome 90+ / Edge 90+ |
| Node.js | v16+ *(portal only)* |
| OS | Windows · macOS · Linux |

---

<div align="center">

## 👤 Author

**Khayrol Islam**

[![GitHub](https://img.shields.io/badge/GitHub-gitkhayrol-181717?style=for-the-badge&logo=github)](https://github.com/gitkhayrol)
[![Facebook](https://img.shields.io/badge/Facebook-khayrol.islam.35-1877F2?style=for-the-badge&logo=facebook&logoColor=white)](https://www.facebook.com/khayrol.islam.35)

---

*If this project helped you, please ⭐ star the repo!*

[![Star](https://img.shields.io/github/stars/gitkhayrol/gmapscraper?style=for-the-badge&color=f59e0b&logo=github)](https://github.com/gitkhayrol/gmapscraper/stargazers)

</div>
