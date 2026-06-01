// GMapScraper Pro — Content Script v1.2
// Powered by Khayrol Islam | github.com/gitkhayrol

(function () {
  'use strict';

  let active = false;
  let collectedData = [];
  let processedUrls = new Set(); // stores hrefKey() values, not raw hrefs

  // ── Start trigger ──────────────────────────────────────────────────────────
  window.addEventListener('gmapscraper:start', async (e) => {
    if (active) return;
    active = true;
    collectedData = [];
    processedUrls.clear();
    await chrome.storage.local.set({ scrapedData: [], scraping: true, processedKeys: [] });
    await runScraper(e.detail);
  });

  async function shouldContinue(current, max) {
    const { scraping } = await chrome.storage.local.get('scraping');
    if (!scraping) return false;
    if (max > 0 && current >= max) return false;
    return true;
  }

  // ── Main scraper ───────────────────────────────────────────────────────────
  async function runScraper(config) {
    const { cat, location, maxResults } = config;
    const { settings } = await chrome.storage.local.get('settings');
    const SCROLL_DELAY = settings?.scrollDelay || 600;
    const CLICK_DELAY  = settings?.clickDelay  || 350;
    const MAX_RETRIES  = settings?.maxRetries  || 5;
    const max = parseInt(maxResults) || 0;

    updateStatus('Navigating to search results...');

    const keyword = cat + (location ? ' in ' + location : '');
    if (!window.location.href.includes('/maps/search/')) {
      window.location.href = `https://www.google.com/maps/search/${encodeURIComponent(keyword)}`;
      return;
    }

    await waitForListings();
    updateStatus('Scanning listings...');

    let failedScrolls = 0; // tracks consecutive failed scrolls, not failed scrapes

    while (await shouldContinue(collectedData.length, max)) {
      await ensureListView();

      // Filter by pathname-based key — immune to data= parameter churn
      const hrefs = getListingHrefs().filter(h => !processedUrls.has(hrefKey(h)));

      for (const href of hrefs) {
        if (!await shouldContinue(collectedData.length, max)) break;
        if (processedUrls.has(hrefKey(href))) continue;

        // Mark processed BEFORE clicking to prevent re-processing on any reload
        processedUrls.add(hrefKey(href));

        const clicked = await clickListingByHref(href);
        if (!clicked) {
          updateStatus(`Skipped (no anchor) — ${collectedData.length} collected`);
          continue;
        }

        await sleep(jitter(CLICK_DELAY));

        const info = await waitAndScrape();

        if (info && !isDuplicate(info)) {
          collectedData.push(info);
          await chrome.storage.local.set({ scrapedData: [...collectedData] });
          updateStatus(`Collected ${collectedData.length} — ${info.name}`);
          // Persist dedup keys to survive any page reload
          if (collectedData.length % 5 === 0) {
            await chrome.storage.local.set({ processedKeys: [...processedUrls] });
          }
        }

        await backToListView();
        await sleep(jitter(80));
      }

      // Always try to scroll for more — only break on repeated scroll failure
      const scrolled = await scrollSidebar();
      if (scrolled) {
        failedScrolls = 0;
      } else {
        failedScrolls++;
        if (failedScrolls >= MAX_RETRIES) break;
      }
      await sleep(jitter(SCROLL_DELAY));
    }

    active = false;
    await chrome.storage.local.set({ scraping: false, processedKeys: [] });
    updateStatus(`Done! ${collectedData.length} records collected.`);
  }

  // ── Dedup check — catches same business with different URL params ───────────
  function isDuplicate(info) {
    return collectedData.some(r =>
      r.name === info.name &&
      ((r.phone && r.phone === info.phone) || (r.address && r.address === info.address))
    );
  }

  // ── URL key: pathname only — strips the volatile data= parameter ───────────
  function hrefKey(href) {
    try { return new URL(href).pathname; }
    catch (_) { return href; }
  }

  // ── Listing helpers ────────────────────────────────────────────────────────
  function getListingHrefs() {
    const anchors = document.querySelectorAll('a.hfpxzc');
    if (anchors.length > 0)
      return Array.from(anchors).map(a => a.href).filter(Boolean);
    return Array.from(document.querySelectorAll('div.Nv2PK, [data-result-index]'))
      .map(c => c.querySelector('a[href*="/maps/place/"]')?.href)
      .filter(Boolean);
  }

  async function clickListingByHref(href) {
    const key = hrefKey(href);
    const anchors = document.querySelectorAll('a.hfpxzc');
    for (const a of anchors) {
      if (hrefKey(a.href) === key) {
        a.scrollIntoView({ block: 'center', behavior: 'smooth' });
        await sleep(jitter(100));
        const prevUrl = window.location.href;
        a.click();
        // Wait for Maps to navigate to the place URL before scraping
        await waitForUrlChange(prevUrl, 1500);
        return true;
      }
    }
    return false;
  }

  async function waitForUrlChange(prevUrl, timeout = 1500) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (window.location.href !== prevUrl) return true;
      await sleep(100);
    }
    return false;
  }

  async function waitForListings(timeout = 8000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (getListingHrefs().length > 0) return true;
      await sleep(200);
    }
    return false;
  }

  // ── Panel navigation ───────────────────────────────────────────────────────
  async function ensureListView() {
    if (getListingHrefs().length > 0) return;
    await backToListView();
  }

  async function backToListView() {
    if (getListingHrefs().length > 0) return;
    // Try every known Maps back-button selector (SPA navigation — no page reload)
    const selectors = [
      'button[aria-label="Back"]',
      'button[data-tooltip="Back"]',
      '[jsaction*="pane.back"]',
      '.XJnGQe button',
      '.LBgpqf button',
      '.RWPxGd button',
      '[aria-label="Close"]'
    ];
    for (const sel of selectors) {
      const btn = document.querySelector(sel);
      if (btn) {
        btn.click();
        await sleep(350);
        if (getListingHrefs().length > 0) return;
      }
    }
    // Fallback: SPA history pop (processedKeys in storage survive any reload)
    history.back();
    await waitForListings(5000);
  }

  // ── Scrape detail panel ────────────────────────────────────────────────────
  async function waitAndScrape() {
    for (let i = 0; i < 20; i++) {
      const nameEl = getBusinessNameEl();
      if (nameEl) {
        await sleep(150);
        const panel =
          nameEl.closest('[role="main"]') ||
          nameEl.closest('.rogA2c') ||
          document.querySelector('[role="main"]');
        return extractData(panel || document.body, nameEl);
      }
      await sleep(150);
    }
    return null;
  }

  function getBusinessNameEl() {
    for (const sel of ['h1.DUwDvf', 'h1.fontHeadlineLarge', '[data-attrid="title"]']) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const text = el.textContent.trim();
      if (text && text !== 'Results' && text !== 'Search results' && text.length > 1) return el;
    }
    return null;
  }

  // ── Data extraction ────────────────────────────────────────────────────────
  function extractData(panel, nameEl) {
    const q = sel =>
      (panel.querySelector(sel) || document.querySelector(sel))?.textContent?.trim() || '';

    const name = nameEl?.textContent?.trim() ||
                 document.title.replace(/ - Google Maps$/, '').trim();
    if (!name || name === 'Results' || name.length < 2) return null;

    const category = q('.DkEaL') || q('.YhemCb') || q('[jsan*="category"]') || q('.mgr77e button');

    const addrEl     = findDataItem(panel, 'address');
    const rawAddress = addrEl?.querySelector('.Io6YTe, .fontBodyMedium')?.textContent?.trim() || '';
    const parsed     = parseAddress(rawAddress);

    const phoneEl = findDataItem(panel, 'phone');
    const phone   = phoneEl?.querySelector('.Io6YTe')?.textContent?.trim() || '';

    const websiteEl =
      panel.querySelector('[data-item-id="authority"] a') ||
      panel.querySelector('a[data-item-id*="authority"]') ||
      panel.querySelector('[aria-label*="website" i] a');
    const website = websiteEl?.href || '';

    const emailMatch = panel.innerHTML.match(
      /[a-zA-Z0-9._%+\-]+@(?!sentry\.|example\.|google\.|gstatic\.)[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/
    );
    const email = emailMatch?.[0] || '';

    const ratingEl =
      panel.querySelector('.F7nice span[aria-hidden="true"]') ||
      panel.querySelector('[aria-label*="stars" i]');
    const rating = ratingEl?.textContent?.trim() ||
                   ratingEl?.getAttribute('aria-label')?.match(/[\d.]+/)?.[0] || '';

    const reviewsEl = panel.querySelector('.F7nice span[aria-label*="review" i]');
    const reviews   = reviewsEl?.textContent?.replace(/[()]/g, '').trim() || '';

    const hoursEl =
      panel.querySelector('[data-item-id*="oh"] .Io6YTe') ||
      panel.querySelector('.t39EBf .G8aQO') ||
      panel.querySelector('.o0rrZb');
    const hours = hoursEl?.textContent?.trim() || '';

    const coords   = getCoords();
    const plusEl   = findDataItem(panel, 'plus_code');
    const plus_code = plusEl?.querySelector('.Io6YTe')?.textContent?.trim() || '';

    return {
      name, category, phone, email, website,
      address: rawAddress, city: parsed.city, state: parsed.state,
      country: parsed.country, zip: parsed.zip,
      lat: coords.lat, lng: coords.lng,
      rating, reviews, hours, plus_code,
      scraped_at: new Date().toISOString()
    };
  }

  function findDataItem(panel, keyword) {
    return panel.querySelector(`[data-item-id*="${keyword}"]`) ||
      [...panel.querySelectorAll('[data-item-id]')]
        .find(el => el.dataset.itemId?.toLowerCase().includes(keyword));
  }

  function getCoords() {
    for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const d = JSON.parse(script.textContent);
        const geo = d.geo || d['@graph']?.[0]?.geo;
        if (geo?.latitude && geo?.longitude)
          return { lat: String(geo.latitude), lng: String(geo.longitude) };
      } catch (_) {}
    }
    const m = window.location.href.match(/@([\-\d.]+),([\-\d.]+)/);
    return { lat: m?.[1] || '', lng: m?.[2] || '' };
  }

  // ── Address parser ─────────────────────────────────────────────────────────
  function parseAddress(addr) {
    if (!addr) return { city: '', state: '', country: '', zip: '' };
    const zip   = addr.match(/\b\d{4,6}(?:[-\s]\d{4})?\b/)?.[0] || '';
    const parts = addr.split(',').map(s => s.trim()).filter(Boolean);
    return {
      country: parts.at(-1) || '',
      state:   parts.at(-2)?.replace(/\d+/g, '').trim() || '',
      city:    parts.at(-3) || '',
      zip
    };
  }

  // ── Scroll the sidebar ─────────────────────────────────────────────────────
  async function scrollSidebar() {
    const feed =
      document.querySelector('[role="feed"]') ||
      document.querySelector('div.m6QErb[aria-label]') ||
      document.querySelector('.DxyBCb');
    if (!feed) return false;
    const before = feed.scrollTop;
    feed.scrollTop += 900;
    await sleep(150);
    return feed.scrollTop > before;
  }

  // ── Utilities ──────────────────────────────────────────────────────────────
  function sleep(ms)   { return new Promise(r => setTimeout(r, ms)); }
  function jitter(ms)  { return ms * (0.75 + Math.random() * 0.5); }
  function updateStatus(msg) { chrome.storage.local.set({ scrapeStatus: msg }); }

  // ── Resume after navigation — restores processedUrls from storage ──────────
  window.addEventListener('load', async () => {
    const { scraping, scrapeConfig } = await chrome.storage.local.get(['scraping', 'scrapeConfig']);
    if (scraping && scrapeConfig && !active) {
      active = true;
      const { scrapedData, processedKeys } = await chrome.storage.local.get(['scrapedData', 'processedKeys']);
      collectedData = scrapedData || [];
      processedUrls = new Set(processedKeys || []);
      await runScraper(scrapeConfig);
    }
  });

})();
