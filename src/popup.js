// GMapScraper Pro — Popup Controller
// Powered by Khayrol Islam | github.com/gitkhayrol

let selectedCategory = 'restaurant';
let selectedFormat = 'csv';
let isScraping = false;

// ── Tab switching ──────────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
    if (tab.dataset.tab === 'results') loadResults();
  });
});

// ── Category selection ─────────────────────────────────────────────────────
document.querySelectorAll('.cat-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedCategory = btn.dataset.cat;
    document.getElementById('customCatField').style.display =
      selectedCategory === 'custom' ? 'block' : 'none';
  });
});

// ── Category search filter ─────────────────────────────────────────────────
document.getElementById('catSearch').addEventListener('input', function () {
  const q = this.value.toLowerCase().trim();
  document.querySelectorAll('.cat-btn').forEach(btn => {
    const label = btn.textContent.toLowerCase();
    const cat = (btn.dataset.cat || '').toLowerCase();
    btn.style.display = (!q || label.includes(q) || cat.includes(q)) ? '' : 'none';
  });
});

// ── Radius slider ──────────────────────────────────────────────────────────
document.getElementById('radiusRange').addEventListener('input', function () {
  document.getElementById('radiusVal').textContent = this.value + ' km';
});

// ── Export format ──────────────────────────────────────────────────────────
document.querySelectorAll('.export-opt').forEach(opt => {
  opt.addEventListener('click', () => {
    document.querySelectorAll('.export-opt').forEach(o => o.classList.remove('selected'));
    opt.classList.add('selected');
    selectedFormat = opt.dataset.fmt;
  });
});

// ── Checkbox styling ───────────────────────────────────────────────────────
document.querySelectorAll('.check-item').forEach(item => {
  const cb = item.querySelector('input[type=checkbox]');
  const update = () => item.classList.toggle('checked', cb.checked);
  cb.addEventListener('change', update);
  update();
});

// ── Open Google Maps ───────────────────────────────────────────────────────
document.getElementById('openMapsBtn').addEventListener('click', () => {
  const location = document.getElementById('searchLocation').value.trim();
  const cat = selectedCategory === 'custom'
    ? document.getElementById('customCat').value.trim()
    : selectedCategory;
  const query = encodeURIComponent(`${cat}${location ? ' in ' + location : ''}`);
  chrome.tabs.create({ url: `https://www.google.com/maps/search/${query}` });
});

// ── Start Scraping ─────────────────────────────────────────────────────────
document.getElementById('startBtn').addEventListener('click', async () => {
  if (isScraping) return;

  const location = document.getElementById('searchLocation').value.trim();
  const cat = selectedCategory === 'custom'
    ? document.getElementById('customCat').value.trim()
    : selectedCategory;
  const radius = document.getElementById('radiusRange').value;
  const maxResults = parseInt(document.getElementById('maxResults').value) || 0;

  if (!cat) { setStatus('error', 'Please select or enter a category'); return; }

  // Find or open a Maps tab
  const tabs = await chrome.tabs.query({ url: 'https://www.google.com/maps/*' });
  let mapsTab;

  if (tabs.length > 0) {
    mapsTab = tabs[0];
  } else {
    const query = encodeURIComponent(`${cat}${location ? ' in ' + location : ''}`);
    mapsTab = await chrome.tabs.create({ url: `https://www.google.com/maps/search/${query}` });
    await delay(1500);
  }

  isScraping = true;
  setStatus('running', 'Injecting scraper...');
  document.getElementById('startBtn').style.display = 'none';
  document.getElementById('stopBtn').style.display = 'block';
  setProgress(5);

  // Save config for background/content
  await chrome.storage.local.set({
    scrapeConfig: { cat, location, radius, maxResults },
    scraping: true,
    scrapedData: []
  });

  // Inject content script command
  try {
    await chrome.scripting.executeScript({
      target: { tabId: mapsTab.id },
      func: startScrapeInPage,
      args: [{ cat, location, radius, maxResults }]
    });
    setStatus('running', 'Scraping in progress...');
    setProgress(15);
    pollProgress();
  } catch (e) {
    setStatus('error', 'Error: ' + e.message);
    resetScrapeUI();
  }
});

function startScrapeInPage(config) {
  // This runs in the Maps tab context
  window.__gmapScraper = window.__gmapScraper || {};
  window.__gmapScraper.config = config;
  window.__gmapScraper.active = true;
  window.dispatchEvent(new CustomEvent('gmapscraper:start', { detail: config }));
}

// ── Stop Scraping ──────────────────────────────────────────────────────────
document.getElementById('stopBtn').addEventListener('click', async () => {
  await chrome.storage.local.set({ scraping: false });
  isScraping = false;
  setStatus('done', 'Scraping stopped by user');
  resetScrapeUI();
  loadResults();
});

// ── Poll progress ──────────────────────────────────────────────────────────
function pollProgress() {
  const interval = setInterval(async () => { // poll at 700ms for snappier counter
    const data = await chrome.storage.local.get(['scrapedData', 'scraping', 'scrapeStatus']);
    const count = (data.scrapedData || []).length;
    const config = await chrome.storage.local.get('scrapeConfig');
    const max = config.scrapeConfig?.maxResults || 0;

    document.getElementById('countTag').textContent = count;

    if (data.scrapeStatus) {
      setStatus('running', data.scrapeStatus);
    }

    const pct = max > 0 ? Math.min(15 + (count / max) * 80, 95) : Math.min(15 + count * 0.5, 90);
    setProgress(pct);

    if (!data.scraping || (max > 0 && count >= max)) {
      clearInterval(interval);
      isScraping = false;
      setStatus('done', `✓ Done! ${count} records collected`);
      setProgress(100);
      resetScrapeUI();
    }
  }, 700);
}

// ── Results ────────────────────────────────────────────────────────────────
async function loadResults() {
  const { scrapedData } = await chrome.storage.local.get('scrapedData');
  const data = scrapedData || [];

  document.getElementById('totalCount').textContent = data.length;
  document.getElementById('withPhoneCount').textContent = data.filter(d => d.phone).length;
  document.getElementById('withEmailCount').textContent = data.filter(d => d.email).length;

  const wrap = document.getElementById('resultsWrap');
  if (data.length === 0) {
    wrap.innerHTML = `<div class="empty-state"><div class="big-emoji">📭</div><p>No results yet.<br>Go to Scrape tab and start collecting data.</p></div>`;
    return;
  }

  let html = `<table><thead><tr>
    <th>#</th><th>Name</th><th>Phone</th><th>City</th><th>⭐</th><th>Reviews</th>
  </tr></thead><tbody>`;
  data.forEach((r, i) => {
    html += `<tr>
      <td>${i + 1}</td>
      <td title="${r.name || ''}">${r.name || '—'}</td>
      <td>${r.phone || '—'}</td>
      <td>${r.city || r.country || '—'}</td>
      <td>${r.rating || '—'}</td>
      <td>${r.reviews || '—'}</td>
    </tr>`;
  });
  html += '</tbody></table>';
  wrap.innerHTML = html;
}

// ── Clear Results ──────────────────────────────────────────────────────────
document.getElementById('clearResultsBtn').addEventListener('click', async () => {
  if (confirm('Clear all scraped data?')) {
    await chrome.storage.local.set({ scrapedData: [] });
    loadResults();
    document.getElementById('countTag').textContent = '0';
    setStatus('', 'Ready to scrape');
    setProgress(0);
  }
});

document.getElementById('refreshResultsBtn').addEventListener('click', loadResults);

// ── Enrich: visit each website and extract email + phone ───────────────────
let enriching = false;

document.getElementById('enrichBtn').addEventListener('click', async () => {
  if (enriching) return;

  const { scrapedData } = await chrome.storage.local.get('scrapedData');
  const data = scrapedData || [];
  const withSite = data.filter(r => r.website);

  if (withSite.length === 0) {
    alert('No records with a website URL found. Run a scrape first.');
    return;
  }

  enriching = true;
  await chrome.storage.local.set({ enriching: true });

  const btn      = document.getElementById('enrichBtn');
  const wrap     = document.getElementById('enrichWrap');
  const bar      = document.getElementById('enrichBar');
  const statusEl = document.getElementById('enrichStatus');
  const countTag = document.getElementById('enrichCountTag');

  btn.textContent    = '⏳ Enriching...';
  btn.disabled       = true;
  wrap.style.display = 'block';

  const indices = data.reduce((acc, r, i) => (r.website ? [...acc, i] : acc), []);
  const total   = indices.length;
  let done = 0, found = 0;

  // Worker: fetch one website and extract contact info
  const processOne = async (idx) => {
    const r = data[idx];
    try {
      const resp = await chrome.runtime.sendMessage({ type: 'fetchWebsite', url: r.website });
      if (resp?.ok && resp.html) {
        const email = extractEmailFromHtml(resp.html);
        const phone = extractPhoneFromHtml(resp.html);
        let changed = false;
        if (email && email !== r.email) { r.email = email; data[idx] = r; changed = true; }
        if (phone && !r.phone)          { r.phone = phone; data[idx] = r; changed = true; }
        if (changed) found++;
      }
    } catch (_) {}
    done++;
    bar.style.width      = Math.round((done / total) * 100) + '%';
    statusEl.textContent = `${done}/${total} — ${r.name}`;
    countTag.textContent = `+${found}`;
  };

  // Run 5 concurrent fetches at a time (5× faster than serial)
  const CONCURRENCY = 5;
  for (let i = 0; i < indices.length; i += CONCURRENCY) {
    await Promise.allSettled(indices.slice(i, i + CONCURRENCY).map(processOne));
  }

  await chrome.storage.local.set({ scrapedData: data, enriching: false });

  enriching         = false;
  btn.disabled      = false;
  btn.textContent   = `✅ Done — ${found} records enriched`;
  statusEl.textContent = `Visited ${total} websites · found ${found} emails/phones`;
  countTag.textContent = `+${found}`;

  loadResults();
  setTimeout(() => { btn.textContent = '🔍 Find Emails & Phones from Websites'; }, 4000);
});

// ── Email extraction (priority: mailto > schema.org > keyword scan) ────────
function extractEmailFromHtml(html, siteUrl) {
  // 1. mailto: links — most explicit signal on the page
  const mailtos = [...html.matchAll(/href=["']mailto:([^"'?#\s]+)/gi)];
  for (const m of mailtos) {
    const e = m[1].toLowerCase().trim();
    if (isGoodEmail(e)) return e;
  }

  // 2. JSON-LD / schema.org "email" property
  const schemaM = html.match(/"email"\s*:\s*"([^"]{5,80})"/i);
  if (schemaM) {
    const e = schemaM[1].toLowerCase().trim();
    if (isGoodEmail(e)) return e;
  }

  // 3. General scan — strip scripts/styles to reduce noise
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');

  const regex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  const candidates = new Set();
  let m;
  while ((m = regex.exec(stripped)) !== null) {
    const e = m[0].toLowerCase();
    if (isGoodEmail(e)) candidates.add(e);
  }

  // Prefer business-like local parts
  for (const e of candidates) {
    if (/^(contact|info|hello|support|admin|sales|enquiry|inquiry|office|mail|team|reception|help)\b/i.test(e.split('@')[0]))
      return e;
  }

  return [...candidates][0] || '';
}

function isGoodEmail(e) {
  // Reject image files, CDN assets, tracking, and obvious placeholder domains
  return !/\.(png|jpg|gif|svg|webp|js|css|json|woff|ttf)$/i.test(e) &&
    !/sentry\.|example\.|google\.|wix\.|wordpress\.|yourdomain|noreply|no-reply|@2x\.|gtm\.|cloudflare\.|amazonaws\./i.test(e);
}

// ── Phone extraction (priority: tel: > schema.org > keyword context) ───────
function extractPhoneFromHtml(html) {
  // 1. <a href="tel:..."> — definitive phone link
  const telM = html.match(/href=["']tel:([^"']+)["']/i);
  if (telM) {
    const p = decodeURIComponent(telM[1]).replace(/\s+/g, ' ').trim();
    if (p.replace(/\D/g, '').length >= 7) return p;
  }

  // 2. JSON-LD / schema.org "telephone" property
  const schemaM = html.match(/"telephone"\s*:\s*"([^"]{6,25})"/i);
  if (schemaM) return schemaM[1].trim();

  // 3. Plain-text context scan near phone/tel/call keywords
  const plain = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const ctxM  = plain.match(
    /(?:phone|tel(?:ephone)?|call us|mob(?:ile)?|whatsapp)[:\s]{0,6}(\+?[\d][\d\s\-\.\(\)\/]{7,20}\d)/i
  );
  if (ctxM) {
    const p = ctxM[1].trim();
    if (p.replace(/\D/g, '').length >= 7) return p;
  }

  return '';
}

// ── Export ─────────────────────────────────────────────────────────────────
document.getElementById('exportBtn').addEventListener('click', doExport);
document.getElementById('copyClipboardBtn').addEventListener('click', doCopyClipboard);

async function getExportData() {
  const { scrapedData } = await chrome.storage.local.get('scrapedData');
  const data = scrapedData || [];
  const selectedFields = Array.from(document.querySelectorAll('#fieldsCheck input:checked')).map(c => c.value);
  return { data, selectedFields };
}

const FIELD_LABELS = {
  name: 'Business Name', category: 'Category', phone: 'Phone', email: 'Email',
  website: 'Website', address: 'Address', city: 'City', state: 'State',
  country: 'Country', zip: 'ZIP/Postal', lat: 'Latitude', lng: 'Longitude',
  rating: 'Rating', reviews: 'Reviews', hours: 'Hours', plus_code: 'Plus Code',
  scraped_at: 'Scraped At'
};

async function doExport() {
  const { data, selectedFields } = await getExportData();
  if (!data.length) { alert('No data to export!'); return; }

  let content, mimeType, ext;

  if (selectedFormat === 'csv') {
    const header = selectedFields.map(f => FIELD_LABELS[f] || f).join(',');
    const rows = data.map(r =>
      selectedFields.map(f => `"${(r[f] || '').toString().replace(/"/g, '""')}"`).join(',')
    );
    content = [header, ...rows].join('\n');
    mimeType = 'text/csv'; ext = 'csv';

  } else if (selectedFormat === 'json') {
    const filtered = data.map(r => {
      const obj = {};
      selectedFields.forEach(f => { obj[FIELD_LABELS[f] || f] = r[f] || ''; });
      return obj;
    });
    content = JSON.stringify(filtered, null, 2);
    mimeType = 'application/json'; ext = 'json';

  } else if (selectedFormat === 'excel') {
    // TSV that Excel opens natively
    const header = selectedFields.map(f => FIELD_LABELS[f] || f).join('\t');
    const rows = data.map(r => selectedFields.map(f => (r[f] || '').toString()).join('\t'));
    content = [header, ...rows].join('\n');
    mimeType = 'text/tab-separated-values'; ext = 'xls';

  } else if (selectedFormat === 'txt') {
    const lines = data.map((r, i) => {
      const parts = selectedFields.map(f => `${FIELD_LABELS[f] || f}: ${r[f] || 'N/A'}`);
      return `[${i + 1}] ${parts.join(' | ')}`;
    });
    content = lines.join('\n');
    mimeType = 'text/plain'; ext = 'txt';
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  await chrome.downloads.download({
    url, filename: `gmapscraper_${ts}.${ext}`, saveAs: true
  });
}

async function doCopyClipboard() {
  const { data, selectedFields } = await getExportData();
  if (!data.length) { alert('No data!'); return; }
  const header = selectedFields.map(f => FIELD_LABELS[f] || f).join('\t');
  const rows = data.map(r => selectedFields.map(f => (r[f] || '')).join('\t'));
  const text = [header, ...rows].join('\n');
  await navigator.clipboard.writeText(text);
  const btn = document.getElementById('copyClipboardBtn');
  btn.textContent = '✅ Copied!';
  setTimeout(() => { btn.textContent = '📋 Copy to Clipboard'; }, 2000);
}

// ── Settings ───────────────────────────────────────────────────────────────
document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
  await chrome.storage.local.set({
    settings: {
      scrollDelay: parseInt(document.getElementById('scrollDelay').value),
      clickDelay: parseInt(document.getElementById('clickDelay').value),
      maxRetries: parseInt(document.getElementById('maxRetries').value)
    }
  });
  const btn = document.getElementById('saveSettingsBtn');
  btn.textContent = '✅ Saved!';
  setTimeout(() => { btn.textContent = '💾 Save Settings'; }, 2000);
});

async function loadSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  if (!settings) return;
  if (settings.scrollDelay) document.getElementById('scrollDelay').value = settings.scrollDelay;
  if (settings.clickDelay) document.getElementById('clickDelay').value = settings.clickDelay;
  if (settings.maxRetries) document.getElementById('maxRetries').value = settings.maxRetries;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function setStatus(type, msg) {
  const dot = document.getElementById('statusDot');
  dot.className = 'status-dot' + (type ? ' ' + type : '');
  document.getElementById('statusText').textContent = msg;
}

function setProgress(pct) {
  document.getElementById('progressBar').style.width = pct + '%';
}

function resetScrapeUI() {
  isScraping = false;
  document.getElementById('startBtn').style.display = 'flex';
  document.getElementById('stopBtn').style.display = 'none';
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Init — restore live state if popup was closed mid-operation ───────────
loadSettings();
loadResults();

(async () => {
  const { scraping, enriching: wasEnriching, scrapedData, scrapeStatus } =
    await chrome.storage.local.get(['scraping', 'enriching', 'scrapedData', 'scrapeStatus']);

  // Popup was re-opened while scraping — restore progress UI and restart poll
  if (scraping) {
    isScraping = true;
    const count = (scrapedData || []).length;
    document.getElementById('countTag').textContent = count;
    document.getElementById('startBtn').style.display = 'none';
    document.getElementById('stopBtn').style.display  = 'flex';
    setStatus('running', scrapeStatus || 'Scraping in progress...');
    setProgress(Math.min(15 + count * 0.5, 90));
    pollProgress();
  }

  // Popup was re-opened while enriching — restore enrich UI
  if (wasEnriching && !enriching) {
    const wrap = document.getElementById('enrichWrap');
    const btn  = document.getElementById('enrichBtn');
    wrap.style.display = 'block';
    btn.textContent    = '⏳ Enriching...';
    btn.disabled       = true;
    document.getElementById('enrichStatus').textContent = 'Enrichment running in background...';
  }
})();
