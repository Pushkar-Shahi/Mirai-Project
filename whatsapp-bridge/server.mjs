import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import qrcodeTerminal from 'qrcode-terminal';
import QRCode from 'qrcode';
import pino from 'pino';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.WHATSAPP_BRIDGE_PORT || 3001;
const SESSION_DIR = process.env.WHATSAPP_SESSION_DIR || path.resolve(__dirname, '../.local/whatsapp-session');

let qrCodeRaw = null;
let qrCodeDataUrl = null;
let isConnected = false;
let connectedUser = null;
let sock = null;

async function startWhatsApp() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
    sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: 'silent' }),
      browser: ['Mirai Tracker', 'Chrome', '1.0.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        qrCodeRaw = qr;
        try {
          qrCodeDataUrl = await QRCode.toDataURL(qr, { margin: 2, scale: 6 });
        } catch {
          qrCodeDataUrl = null;
        }
        console.log('\n======================================================');
        console.log('>>> SCAN THIS QR CODE IN WHATSAPP:');
        console.log('>>> (Phone: Settings / Menu > Linked Devices > Link a Device)');
        console.log('======================================================\n');
        qrcodeTerminal.generate(qr, { small: true });
        console.log(`\nOr view QR in browser: http://127.0.0.1:${PORT}/\n`);
      }

      if (connection === 'close') {
        isConnected = false;
        connectedUser = null;
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        console.log(`[Bridge] Connection closed (status: ${statusCode}). Reconnecting: ${shouldReconnect}`);
        if (shouldReconnect) {
          setTimeout(startWhatsApp, 3000);
        } else {
          console.log('[Bridge] Device logged out. Scan new QR code.');
          qrCodeRaw = null;
          qrCodeDataUrl = null;
          setTimeout(startWhatsApp, 2000);
        }
      } else if (connection === 'open') {
        isConnected = true;
        qrCodeRaw = null;
        qrCodeDataUrl = null;
        connectedUser = (sock.user?.id || '').split(':')[0] || 'Unknown';
        console.log('\n======================================================');
        console.log(`[Bridge] WhatsApp CONNECTED as +${connectedUser}!`);
        console.log('======================================================\n');
      }
    });
  } catch (err) {
    console.error('[Bridge] Failed to initialize WhatsApp:', err);
    setTimeout(startWhatsApp, 5000);
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // GET /status
  if (req.method === 'GET' && url.pathname === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      connected: isConnected,
      user: connectedUser,
      has_qr: Boolean(qrCodeRaw)
    }));
    return;
  }

  // GET / (Visual Web Page)
  if (req.method === 'GET' && url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    if (isConnected) {
      res.end(`<!doctype html>
<html>
<head><meta charset="utf-8"><title>WhatsApp Bridge · Connected</title>
<style>
  body { font-family: system-ui, sans-serif; display: grid; place-items: center; min-height: 80vh; background: #0f172a; color: #f8fafc; margin: 0; }
  .card { background: #1e293b; padding: 32px; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); text-align: center; max-width: 400px; }
  .icon { font-size: 56px; color: #22c55e; margin-bottom: 16px; }
  .number { font-size: 20px; font-weight: bold; color: #38bdf8; margin: 8px 0; }
</style>
</head>
<body>
  <div class="card">
    <div class="icon">&#10003;</div>
    <h2>WhatsApp Bridge Active</h2>
    <p>Connected and ready to send reminders.</p>
    <div class="number">+${connectedUser}</div>
  </div>
</body>
</html>`);
    } else if (qrCodeDataUrl) {
      res.end(`<!doctype html>
<html>
<head><meta charset="utf-8"><meta http-equiv="refresh" content="5"><title>WhatsApp Bridge · Link Device</title>
<style>
  body { font-family: system-ui, sans-serif; display: grid; place-items: center; min-height: 80vh; background: #0f172a; color: #f8fafc; margin: 0; }
  .card { background: #1e293b; padding: 32px; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); text-align: center; max-width: 400px; }
  img { border-radius: 12px; background: white; padding: 12px; margin: 16px 0; }
  .hint { color: #94a3b8; font-size: 14px; line-height: 1.5; }
</style>
</head>
<body>
  <div class="card">
    <h2>Link WhatsApp</h2>
    <p class="hint">1. Open WhatsApp on your phone<br>2. Tap <b>Settings</b> or <b>Menu</b> &gt; <b>Linked Devices</b><br>3. Tap <b>Link a Device</b> and point camera here:</p>
    <img src="${qrCodeDataUrl}" alt="WhatsApp QR Code" width="240" height="240">
    <p class="hint">This page will automatically refresh once connected.</p>
  </div>
</body>
</html>`);
    } else {
      res.end(`<!doctype html>
<html>
<head><meta charset="utf-8"><meta http-equiv="refresh" content="2"><title>WhatsApp Bridge · Initializing</title>
<style>
  body { font-family: system-ui, sans-serif; display: grid; place-items: center; min-height: 80vh; background: #0f172a; color: #f8fafc; margin: 0; }
  .card { background: #1e293b; padding: 32px; border-radius: 16px; text-align: center; }
</style>
</head>
<body>
  <div class="card">
    <h2>Initializing WhatsApp connection...</h2>
    <p>Generating pairing code...</p>
  </div>
</body>
</html>`);
    }
    return;
  }

  // POST /send
  if (req.method === 'POST' && url.pathname === '/send') {
    let bodyText = '';
    req.on('data', chunk => { bodyText += chunk; });
    req.on('end', async () => {
      try {
        if (!isConnected || !sock) {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'WhatsApp not connected. Scan QR code on http://127.0.0.1:' + PORT }));
          return;
        }

        const data = JSON.parse(bodyText);
        const to = String(data.to || '').replace(/[^0-9]/g, '');
        const message = String(data.message || '').trim();

        if (!to || to.length < 8) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid recipient phone number' }));
          return;
        }

        if (!message) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Message cannot be empty' }));
          return;
        }

        const jid = `${to}@s.whatsapp.net`;
        const sent = await sock.sendMessage(jid, { text: message });
        const msgId = sent?.key?.id || `wb_${Date.now()}`;

        console.log(`[Bridge] Sent message to +${to} (id: ${msgId})`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          ok: true,
          id: msgId,
          to: `+${to}`
        }));
      } catch (err) {
        console.error('[Bridge] Send error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message || 'Send failed' }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Bridge] WhatsApp Bridge HTTP server listening on http://127.0.0.1:${PORT}`);
  startWhatsApp();
});
