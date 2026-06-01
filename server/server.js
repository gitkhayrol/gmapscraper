// GMapScraper Pro — Web Control Portal
// Powered by Khayrol Islam | github.com/gitkhayrol
// Usage: cd server && npm install && node server.js

const express  = require('express');
const http     = require('http');
const WebSocket = require('ws');
const session  = require('express-session');
const path     = require('path');
const crypto   = require('crypto');

// ── Config — change these ────────────────────────────────────────────────────
const CONFIG = {
  port:     5590,
  username: 'admin',
  password: 'admin123'
};

// ── Server setup ─────────────────────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);
const wss    = new WebSocket.Server({ server });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret:            'gmaps-' + crypto.randomBytes(16).toString('hex'),
  resave:            false,
  saveUninitialized: false,
  cookie:            { maxAge: 24 * 60 * 60 * 1000 }
}));

// ── In-memory state ──────────────────────────────────────────────────────────
let extSocket    = null;          // one extension WS connection
let scrapedData  = [];            // mirrored from extension storage
let state        = {
  scraping: false, enriching: false,
  msg: 'Extension not connected', count: 0, phones: 0, emails: 0
};
const dashboards  = new Set();   // portal browser connections
const wsTokens    = new Set();   // valid short-lived tokens for WS auth

// ── Auth helpers ──────────────────────────────────────────────────────────────
const requireAuth = (req, res, next) =>
  req.session.user ? next() : res.redirect('/login.html');

function mkToken() {
  const t = crypto.randomBytes(20).toString('hex');
  wsTokens.add(t);
  setTimeout(() => wsTokens.delete(t), 60_000); // expire after 60 s
  return t;
}

// ── HTTP routes ───────────────────────────────────────────────────────────────
app.get('/', (req, res) =>
  res.redirect(req.session.user ? '/dashboard.html' : '/login.html'));

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username === CONFIG.username && password === CONFIG.password) {
    req.session.user = username;
    res.json({ ok: true, token: mkToken() });
  } else {
    res.status(401).json({ ok: false, error: 'Invalid credentials' });
  }
});

app.get('/api/wstoken', requireAuth, (req, res) =>
  res.json({ token: mkToken() }));

app.get('/api/data', requireAuth, (req, res) => res.json(scrapedData));
app.get('/api/state', requireAuth, (req, res) =>
  res.json({ ...state, extConnected: extSocket !== null }));

app.post('/api/logout', requireAuth, (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

// ── WebSocket ─────────────────────────────────────────────────────────────────
wss.on('connection', (ws, req) => {
  const qs   = new URLSearchParams(req.url.replace(/^[^?]*/, ''));
  const type = qs.get('type');
  const tok  = qs.get('token');

  // ── Extension connection (no token needed — extension is trusted local app)
  if (type === 'extension') {
    extSocket = ws;
    console.log('[Portal] Extension connected');
    broadcast({ type: 'ext_status', connected: true });
    state.msg = 'Ready';

    ws.on('message', raw => {
      try {
        const msg = JSON.parse(raw);
        // Mirror state from extension
        if (msg.type === 'data') {
          scrapedData    = msg.records;
          state.count    = scrapedData.length;
          state.phones   = scrapedData.filter(r => r.phone).length;
          state.emails   = scrapedData.filter(r => r.email).length;
        }
        if (msg.type === 'status') {
          if (msg.msg      !== undefined) state.msg      = msg.msg;
          if (msg.scraping !== undefined) state.scraping = msg.scraping;
          if (msg.enriching!== undefined) state.enriching= msg.enriching;
        }
        broadcast(msg); // forward to all dashboards
      } catch (_) {}
    });

    ws.on('close', () => {
      extSocket = null;
      state.scraping  = false;
      state.enriching = false;
      state.msg = 'Extension disconnected';
      broadcast({ type: 'ext_status', connected: false });
      console.log('[Portal] Extension disconnected');
    });
    return;
  }

  // ── Dashboard connection (token required)
  if (!wsTokens.has(tok)) { ws.close(1008, 'Unauthorized'); return; }
  wsTokens.delete(tok); // one-use token
  dashboards.add(ws);

  // Send current state to newly connected dashboard
  ws.send(JSON.stringify({
    type: 'init',
    state: { ...state, extConnected: extSocket !== null },
    dataCount: scrapedData.length
  }));

  ws.on('message', raw => {
    // Relay command from dashboard → extension
    if (extSocket?.readyState === WebSocket.OPEN) {
      extSocket.send(raw.toString());
    } else {
      ws.send(JSON.stringify({ type: 'error', msg: 'Extension not connected. Load the extension in Chrome first.' }));
    }
  });

  ws.on('close', () => dashboards.delete(ws));
});

function broadcast(msg) {
  const raw = JSON.stringify(msg);
  dashboards.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) ws.send(raw);
  });
}

// ── Start ─────────────────────────────────────────────────────────────────────
server.listen(CONFIG.port, '127.0.0.1', () => {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   GMapScraper Pro — Web Control Portal   ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log(`║  URL      : http://127.0.0.1:${CONFIG.port}       ║`);
  console.log(`║  Username : ${CONFIG.username.padEnd(30)}║`);
  console.log(`║  Password : ${CONFIG.password.padEnd(30)}║`);
  console.log('╚══════════════════════════════════════════╝');
  console.log('');
});
