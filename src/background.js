// GMapScraper Pro — Background Service Worker v1.1
// Powered by Khayrol Islam | github.com/gitkhayrol

// ── Install defaults ──────────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    scrapedData: [], scraping: false, enriching: false,
    scrapeStatus: 'Ready',
    settings: { scrollDelay: 600, clickDelay: 350, maxRetries: 5 }
  });
  console.log('[GMapScraper Pro] Installed.');
});

// ── Badge updates ─────────────────────────────────────────────────────────────
chrome.storage.onChanged.addListener((changes) => {
  if (changes.scrapedData) {
    const n = changes.scrapedData.newValue?.length || 0;
    chrome.action.setBadgeText({ text: n > 0 ? String(n) : '' });
    chrome.action.setBadgeBackgroundColor({ color: '#00e5ff' });
    sendToPortal({ type: 'data', records: changes.scrapedData.newValue || [] });
  }
  if (changes.scrapeStatus) {
    sendToPortal({ type: 'status', msg: changes.scrapeStatus.newValue });
  }
  if (changes.scraping) {
    sendToPortal({ type: 'status', scraping: changes.scraping.newValue,
      msg: changes.scraping.newValue ? 'Scraping in progress…' : 'Scraping finished' });
  }
  if (changes.enriching) {
    sendToPortal({ type: 'status', enriching: changes.enriching.newValue });
  }
});

// ── Popup fetch handler (used by popup.js for website enrichment) ─────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== 'fetchWebsite') return false;
  fetchLimited(msg.url).then(sendResponse);
  return true;
});

// ── Website fetcher ────────────────────────────────────────────────────────────
async function fetchLimited(url, maxBytes = 307200) {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal, redirect: 'follow',
      headers: { 'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8', 'Accept-Language': 'en-US,en;q=0.5' }
    });
    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let html = '', bytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
      html  += decoder.decode(value, { stream: true });
      if (bytes >= maxBytes) { reader.cancel(); break; }
    }
    clearTimeout(timer);
    return { ok: true, html };
  } catch (err) {
    clearTimeout(timer);
    return { ok: false, error: err.message };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//   PORTAL WebSocket CLIENT
// ══════════════════════════════════════════════════════════════════════════════

let portalWs = null;

function connectToPortal() {
  try {
    const ws = new WebSocket('ws://127.0.0.1:5590?type=extension');

    ws.onopen = () => {
      portalWs = ws;
      console.log('[Ext] Portal connected');
      // Send current state
      chrome.storage.local.get(['scrapedData','scraping','enriching','scrapeStatus'], (d) => {
        sendToPortal({ type: 'status', scraping: d.scraping||false, enriching: d.enriching||false, msg: d.scrapeStatus||'Ready' });
        if (d.scrapedData?.length) sendToPortal({ type: 'data', records: d.scrapedData });
      });
    };

    ws.onmessage = async ({ data: raw }) => {
      try { await handlePortalCommand(JSON.parse(raw)); } catch (_) {}
    };

    ws.onclose = () => {
      portalWs = null;
      // Retry after 5 s — will be re-tried faster if alarm fires
      setTimeout(connectToPortal, 5000);
    };

    ws.onerror = () => {
      // Portal server not running — retry quietly
      setTimeout(connectToPortal, 10000);
    };
  } catch (_) {
    setTimeout(connectToPortal, 10000);
  }
}

function sendToPortal(msg) {
  if (portalWs?.readyState === WebSocket.OPEN)
    portalWs.send(JSON.stringify(msg));
}

// ── Command router ────────────────────────────────────────────────────────────
async function handlePortalCommand(msg) {
  switch (msg.type) {
    case 'start_scrape': await portalStartScrape(msg.config); break;
    case 'stop_scrape':  await chrome.storage.local.set({ scraping: false }); break;
    case 'open_maps':    await portalOpenMaps(msg.config); break;
    case 'start_enrich': await portalEnrich(); break;
    case 'clear_data':
      await chrome.storage.local.set({ scrapedData: [] });
      sendToPortal({ type: 'data', records: [] });
      break;
    case 'get_data': {
      const { scrapedData } = await chrome.storage.local.get('scrapedData');
      sendToPortal({ type: 'data', records: scrapedData || [] });
      break;
    }
    case 'ping':
      sendToPortal({ type: 'pong' });
      break;
  }
}

// ── Start scrape (portal-initiated) ──────────────────────────────────────────
async function portalStartScrape(config) {
  const { cat, location, maxResults } = config;
  const tabs = await chrome.tabs.query({ url: 'https://www.google.com/maps/*' });
  let mapsTab;

  if (tabs.length > 0) {
    mapsTab = tabs[0];
    await chrome.tabs.update(mapsTab.id, { active: true });
  } else {
    const q = encodeURIComponent(`${cat}${location ? ' in ' + location : ''}`);
    mapsTab = await chrome.tabs.create({ url: `https://www.google.com/maps/search/${q}` });
    await sleep(1500);
  }

  await chrome.storage.local.set({ scrapeConfig: config, scraping: true, scrapedData: [] });

  try {
    await chrome.scripting.executeScript({
      target: { tabId: mapsTab.id },
      func: (cfg) => window.dispatchEvent(new CustomEvent('gmapscraper:start', { detail: cfg })),
      args: [config]
    });
  } catch (e) {
    sendToPortal({ type: 'error', msg: 'Could not inject scraper. Make sure Google Maps tab is open: ' + e.message });
    await chrome.storage.local.set({ scraping: false });
  }
}

// ── Open Maps (portal-initiated) ─────────────────────────────────────────────
async function portalOpenMaps(config) {
  const { cat, location } = config;
  const q = encodeURIComponent(`${cat}${location ? ' in ' + location : ''}`);
  await chrome.tabs.create({ url: `https://www.google.com/maps/search/${q}` });
}

// ── Enrich (portal-initiated, concurrent) ────────────────────────────────────
async function portalEnrich() {
  const { scrapedData } = await chrome.storage.local.get('scrapedData');
  const data = scrapedData || [];
  const indices = data.reduce((a, r, i) => r.website ? [...a, i] : a, []);

  if (!indices.length) {
    sendToPortal({ type: 'status', msg: 'No records with websites to enrich' });
    return;
  }

  await chrome.storage.local.set({ enriching: true });
  sendToPortal({ type: 'status', enriching: true, msg: 'Enriching…' });

  let done = 0, found = 0;
  const total = indices.length;

  const processOne = async (idx) => {
    const r = data[idx];
    try {
      const res = await fetchLimited(r.website);
      if (res.ok && res.html) {
        const email = extractEmail(res.html);
        const phone = extractPhone(res.html);
        let changed = false;
        if (email && email !== r.email) { r.email = email; data[idx] = r; changed = true; }
        if (phone && !r.phone)          { r.phone = phone; data[idx] = r; changed = true; }
        if (changed) found++;
      }
    } catch (_) {}
    done++;
    sendToPortal({ type: 'enrich_progress', done, total, found, name: r.name });
  };

  const CONCURRENCY = 5;
  for (let i = 0; i < indices.length; i += CONCURRENCY) {
    await Promise.allSettled(indices.slice(i, i + CONCURRENCY).map(processOne));
  }

  await chrome.storage.local.set({ scrapedData: data, enriching: false });
  sendToPortal({ type: 'status', enriching: false, msg: `Enrichment done — ${found} found` });
  sendToPortal({ type: 'data', records: data });
}

// ── Email extractor ───────────────────────────────────────────────────────────
function extractEmail(html) {
  const mailtoM = [...html.matchAll(/href=["']mailto:([^"'?#\s]+)/gi)];
  for (const m of mailtoM) { const e = m[1].toLowerCase(); if (goodEmail(e)) return e; }

  const schemaM = html.match(/"email"\s*:\s*"([^"]{5,80})"/i);
  if (schemaM) { const e = schemaM[1].toLowerCase(); if (goodEmail(e)) return e; }

  const clean = html.replace(/<script[\s\S]*?<\/script>/gi,'').replace(/<style[\s\S]*?<\/style>/gi,'');
  const hits = new Set();
  let m;
  const re = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  while ((m = re.exec(clean)) !== null) { const e = m[0].toLowerCase(); if (goodEmail(e)) hits.add(e); }
  for (const e of hits) {
    if (/^(contact|info|hello|support|admin|sales|enquiry|office|mail|team)\b/i.test(e.split('@')[0])) return e;
  }
  return [...hits][0] || '';
}

function goodEmail(e) {
  return !/\.(png|jpg|gif|svg|webp|js|css|json|woff|ttf)$/i.test(e) &&
    !/sentry\.|example\.|google\.|wix\.|wordpress\.|yourdomain|noreply|no-reply|@2x\.|cloudflare\.|amazonaws\./i.test(e);
}

// ── Phone extractor ───────────────────────────────────────────────────────────
function extractPhone(html) {
  const telM = html.match(/href=["']tel:([^"']+)["']/i);
  if (telM) { const p = decodeURIComponent(telM[1]).trim(); if (p.replace(/\D/g,'').length >= 7) return p; }

  const schemaM = html.match(/"telephone"\s*:\s*"([^"]{6,25})"/i);
  if (schemaM) return schemaM[1].trim();

  const plain = html.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');
  const ctxM  = plain.match(/(?:phone|tel(?:ephone)?|call us|mob(?:ile)?|whatsapp)[:\s]{0,6}(\+?[\d][\d\s\-\.\(\)\/]{7,20}\d)/i);
  if (ctxM) { const p = ctxM[1].trim(); if (p.replace(/\D/g,'').length >= 7) return p; }
  return '';
}

// ── Alarm keepalive — wakes service worker every minute to reconnect ──────────
chrome.alarms.create('portalKeepalive', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== 'portalKeepalive') return;
  if (!portalWs || portalWs.readyState !== WebSocket.OPEN) {
    connectToPortal();
  } else {
    sendToPortal({ type: 'ping' });
  }
});

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Start portal connection on service worker boot ────────────────────────────
connectToPortal();
