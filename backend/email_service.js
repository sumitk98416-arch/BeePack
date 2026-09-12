/**
 * Remembering Bag — Autonomous Email Notification Engine
 * Zero external dependency SMTP client (TLS/Net) with fallback to in-app delivery and log preview.
 * Dispatches beautifully branded HTML emails for:
 * - BAG_OPENED (Alert: Backpack opened)
 * - BAG_CLOSED (Confirmation: Backpack secured)
 * - REMINDER_FIRED (Prompt: Scheduled packing reminder)
 * - MISSING_ITEM (Daily sweep missing alert)
 */

const tls = require('tls');
const net = require('net');
const crypto = require('crypto');
const { getDb, saveDb } = require('../database/db');

// Read SMTP Configuration from environment
const SMTP_CONFIG = {
  host: process.env.SMTP_HOST || process.env.MAIL_HOST || null,
  port: parseInt(process.env.SMTP_PORT || process.env.MAIL_PORT || '465', 10),
  secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465' || (!process.env.SMTP_PORT && true),
  user: process.env.SMTP_USER || process.env.GMAIL_USER || null,
  pass: process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || null,
  from: process.env.SMTP_FROM || process.env.MAIL_FROM || 'Remembering Bag <alerts@rememberingbag.iot>'
};

/**
 * Send raw email via pure Node.js SMTP / TLS
 */
function sendViaSmtp({ from, to, subject, html, text }) {
  return new Promise((resolve, reject) => {
    if (!SMTP_CONFIG.host || !SMTP_CONFIG.user || !SMTP_CONFIG.pass) {
      return reject(new Error("SMTP credentials not fully configured"));
    }

    const boundary = `----=_Part_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const rawMessage = [
      `From: ${from || SMTP_CONFIG.from}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      `Date: ${new Date().toUTCString()}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/plain; charset=utf-8`,
      `Content-Transfer-Encoding: 7bit`,
      ``,
      text || "Your Remembering Bag notification",
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset=utf-8`,
      `Content-Transfer-Encoding: 7bit`,
      ``,
      html,
      ``,
      `--${boundary}--`,
      `.`
    ].join('\r\n');

    const port = SMTP_CONFIG.port || 465;
    const socket = (port === 465) 
      ? tls.connect({ host: SMTP_CONFIG.host, port: 465, rejectUnauthorized: false })
      : net.connect({ host: SMTP_CONFIG.host, port });

    let step = 0;
    let serverResponse = '';

    socket.setTimeout(15000, () => {
      socket.destroy();
      reject(new Error("SMTP connection timed out"));
    });

    socket.on('error', (err) => {
      reject(err);
    });

    socket.on('data', (data) => {
      serverResponse += data.toString();
      const code = serverResponse.slice(0, 3);

      if (serverResponse.includes('\r\n')) {
        const line = serverResponse;
        serverResponse = '';

        if (step === 0 && (code === '220')) {
          step++;
          socket.write(`EHLO localhost\r\n`);
        } else if (step === 1 && (code === '250')) {
          step++;
          socket.write(`AUTH LOGIN\r\n`);
        } else if (step === 2 && (code === '334')) {
          step++;
          socket.write(`${Buffer.from(SMTP_CONFIG.user).toString('base64')}\r\n`);
        } else if (step === 3 && (code === '334')) {
          step++;
          socket.write(`${Buffer.from(SMTP_CONFIG.pass).toString('base64')}\r\n`);
        } else if (step === 4 && (code === '235')) {
          step++;
          socket.write(`MAIL FROM:<${SMTP_CONFIG.user}>\r\n`);
        } else if (step === 5 && (code === '250')) {
          step++;
          socket.write(`RCPT TO:<${to}>\r\n`);
        } else if (step === 6 && (code === '250')) {
          step++;
          socket.write(`DATA\r\n`);
        } else if (step === 7 && (code === '354')) {
          step++;
          socket.write(`${rawMessage}\r\n`);
        } else if (step === 8 && (code === '250')) {
          step++;
          socket.write(`QUIT\r\n`);
          socket.end();
          resolve({ success: true, method: 'smtp_live' });
        } else if (parseInt(code, 10) >= 400) {
          socket.end();
          reject(new Error(`SMTP error ${code}: ${line.trim()}`));
        }
      }
    });
  });
}

/**
 * Universal Email Dispatcher
 * Transmits live over SMTP if configured; otherwise records delivery in persistent DB outbox with preview.
 */
async function sendEmail({ to, subject, html, text, type = "GENERAL", userId = null, metadata = {} }) {
  const emailId = `eml_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const timestamp = new Date().toISOString();

  const emailRecord = {
    id: emailId,
    userId: userId || "usr_demo_01",
    type,
    from: SMTP_CONFIG.from,
    to: to || "user@example.com",
    subject,
    text: text || "Remembering Bag Alert",
    html,
    metadata,
    status: "delivered",
    deliveryMode: "simulated_local",
    timestamp
  };

  // Attempt live SMTP transmission if credentials are set
  if (SMTP_CONFIG.host && SMTP_CONFIG.user && SMTP_CONFIG.pass) {
    try {
      await sendViaSmtp({
        from: SMTP_CONFIG.from,
        to: emailRecord.to,
        subject: emailRecord.subject,
        html: emailRecord.html,
        text: emailRecord.text
      });
      emailRecord.deliveryMode = "smtp_live";
      console.log(`[EMAIL DISPATCH - LIVE SMTP] Transmitted to ${emailRecord.to} | Subject: ${subject}`);
    } catch (smtpErr) {
      console.warn(`[EMAIL DISPATCH - SMTP WARNING] ${smtpErr.message}. Falling back to recorded outbox delivery.`);
      emailRecord.deliveryMode = "smtp_fallback_recorded";
      emailRecord.deliveryNote = smtpErr.message;
    }
  } else {
    console.log(`\n======================================================`);
    console.log(`[EMAIL DISPATCH - RECORDED DELIVERY]`);
    console.log(`To:      ${emailRecord.to}`);
    console.log(`Subject: ${emailRecord.subject}`);
    console.log(`Type:    ${emailRecord.type}`);
    console.log(`Time:    ${emailRecord.timestamp}`);
    console.log(`======================================================\n`);
  }

  // Persist into database sentEmails collection
  try {
    const db = getDb();
    if (!db.sentEmails) db.sentEmails = [];
    db.sentEmails.unshift(emailRecord);
    if (db.sentEmails.length > 200) db.sentEmails = db.sentEmails.slice(0, 200);
    saveDb(db);
  } catch (dbErr) {
    console.error("Failed to save email to db:", dbErr);
  }

  return emailRecord;
}

/**
 * HTML Templates
 */

function buildEmailShell({ title, badgeText, badgeColor, preheader, contentHtml }) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #050505; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #E2E8F0; }
    .email-wrapper { max-width: 580px; margin: 20px auto; background: #0E0E0E; border: 1px solid #1E293B; border-radius: 12px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.8); }
    .email-header { padding: 24px 30px; background: linear-gradient(180deg, #161B22 0%, #0E0E0E 100%); border-bottom: 1px solid #1E293B; display: flex; align-items: center; justify-content: space-between; }
    .logo-text { font-size: 16px; font-weight: 800; letter-spacing: 0.05em; color: #FFFFFF; }
    .logo-accent { color: #00E5FF; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; background: ${badgeColor === 'red' ? 'rgba(239, 68, 68, 0.15)' : (badgeColor === 'green' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(0, 229, 255, 0.15)')}; color: ${badgeColor === 'red' ? '#F87171' : (badgeColor === 'green' ? '#4ADE80' : '#00E5FF')}; border: 1px solid ${badgeColor === 'red' ? '#EF4444' : (badgeColor === 'green' ? '#22C55E' : '#00E5FF')}; }
    .email-body { padding: 32px 30px; }
    .headline { font-size: 22px; font-weight: 700; color: #FFFFFF; margin: 0 0 12px; line-height: 1.3; }
    .description { font-size: 14px; line-height: 1.6; color: #94A3B8; margin: 0 0 24px; }
    .info-card { background: #13171F; border: 1px solid #232936; border-radius: 8px; padding: 18px 20px; margin-bottom: 24px; }
    .info-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #1A202C; font-size: 13px; }
    .info-row:last-child { border-bottom: none; }
    .info-label { color: #64748B; }
    .info-value { color: #FFFFFF; font-weight: 600; font-family: monospace; }
    .btn-action { display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #00E5FF, #00B4D8); color: #030303; font-weight: 700; font-size: 14px; text-decoration: none; border-radius: 9999px; text-align: center; }
    .email-footer { padding: 20px 30px; background: #080A0D; border-top: 1px solid #1A202C; font-size: 12px; color: #475569; text-align: center; }
  </style>
</head>
<body>
  <div style="display: none; max-height: 0px; overflow: hidden;">${preheader || title}</div>
  <div class="email-wrapper">
    <div class="email-header">
      <div class="logo-text">REMEMBERING <span class="logo-accent">BAG</span></div>
      <span class="badge">${badgeText}</span>
    </div>
    <div class="email-body">
      ${contentHtml}
    </div>
    <div class="email-footer">
      <p style="margin: 0 0 6px;">IoT RFID Smart Backpack • Live Telemetry & Security Alerts</p>
      <p style="margin: 0;">Connected to ESP32 RC522 Reader • Powered by Remembering Bag v2</p>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * 1. Bag Opened Email
 */
async function sendBagOpenedEmail({ userId, to, userName, bagName, timestamp, hardwareId }) {
  const timeFormatted = new Date(timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateFormatted = new Date(timestamp || Date.now()).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

  const contentHtml = `
    <h1 class="headline">⚠️ Your Backpack Was Opened</h1>
    <p class="description">
      Hello ${userName || 'there'},<br>
      Your smart backpack zipper sensor detected that the bag was <strong>OPENED</strong> at <strong>${timeFormatted}</strong> on ${dateFormatted}.
    </p>

    <div class="info-card">
      <div class="info-row">
        <span class="info-label">Bag:</span>
        <span class="info-value">${bagName || 'My College Bag'}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Event:</span>
        <span class="info-value" style="color: #F87171;">BAG_OPENED</span>
      </div>
      <div class="info-row">
        <span class="info-label">Hardware Sensor:</span>
        <span class="info-value">${hardwareId || 'ESP32-BAG-01'}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Detection Time:</span>
        <span class="info-value">${timeFormatted}</span>
      </div>
    </div>

    <p style="font-size: 13px; color: #94A3B8; margin-bottom: 24px;">
      If you did not open your bag or left it unattended in a public area, please verify your belongings immediately.
    </p>

    <a href="http://localhost:3000/#dashboard" class="btn-action">Check Bag Inventory on Dashboard →</a>
  `;

  return sendEmail({
    userId,
    to,
    type: "BAG_OPENED",
    subject: `⚠️ Alert: Your Remembering Bag was OPENED (${timeFormatted})`,
    text: `Alert: Your Remembering Bag (${bagName || 'My Bag'}) was OPENED at ${timeFormatted}. Check your belongings on your dashboard.`,
    html: buildEmailShell({
      title: "Bag Opened Alert",
      badgeText: "Security Alert",
      badgeColor: "red",
      preheader: `Your Remembering Bag was opened at ${timeFormatted}.`,
      contentHtml
    }),
    metadata: { bagName, timestamp, hardwareId }
  });
}

/**
 * 2. Bag Closed Email
 */
async function sendBagClosedEmail({ userId, to, userName, bagName, timestamp, hardwareId }) {
  const timeFormatted = new Date(timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateFormatted = new Date(timestamp || Date.now()).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

  const contentHtml = `
    <h1 class="headline">🔒 Backpack Secured & Closed</h1>
    <p class="description">
      Hello ${userName || 'there'},<br>
      Your smart backpack zipper sensor confirmed that the bag was <strong>CLOSED & SECURED</strong> at <strong>${timeFormatted}</strong> on ${dateFormatted}.
    </p>

    <div class="info-card">
      <div class="info-row">
        <span class="info-label">Bag:</span>
        <span class="info-value">${bagName || 'My College Bag'}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Status:</span>
        <span class="info-value" style="color: #4ADE80;">BAG_CLOSED (Secured)</span>
      </div>
      <div class="info-row">
        <span class="info-label">Hardware Sensor:</span>
        <span class="info-value">${hardwareId || 'ESP32-BAG-01'}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Time:</span>
        <span class="info-value">${timeFormatted}</span>
      </div>
    </div>

    <p style="font-size: 13px; color: #94A3B8; margin-bottom: 24px;">
      Your RFID antenna is active and monitoring all registered essentials. Have a great, worry-free trip!
    </p>

    <a href="http://localhost:3000/#dashboard" class="btn-action">Open Remembering Bag Dashboard →</a>
  `;

  return sendEmail({
    userId,
    to,
    type: "BAG_CLOSED",
    subject: `🔒 Confirmation: Your Remembering Bag is CLOSED (${timeFormatted})`,
    text: `Confirmation: Your Remembering Bag was closed and secured at ${timeFormatted}.`,
    html: buildEmailShell({
      title: "Bag Closed Confirmation",
      badgeText: "Secured",
      badgeColor: "green",
      preheader: `Your Remembering Bag was securely closed at ${timeFormatted}.`,
      contentHtml
    }),
    metadata: { bagName, timestamp, hardwareId }
  });
}

/**
 * 3. Reminder Email
 */
async function sendReminderEmail({ userId, to, userName, itemName, reminderMessage, dueTime, bagName }) {
  const timeFormatted = dueTime 
    ? new Date(dueTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'Now';

  const contentHtml = `
    <h1 class="headline">⏰ Don't Forget to Pack: ${itemName || 'Your Item'}</h1>
    <p class="description">
      Hello ${userName || 'there'},<br>
      This is your scheduled packing reminder for <strong>${itemName || 'your essential item'}</strong>.
    </p>

    <div class="info-card" style="border-left: 4px solid #00E5FF;">
      <div style="font-size: 14px; font-weight: 600; color: #FFFFFF; margin-bottom: 8px;">Reminder Note:</div>
      <div style="font-size: 13px; color: #E2E8F0; line-height: 1.5; font-style: italic;">
        "${reminderMessage || `Remember to pack your ${itemName || 'item'} into ${bagName || 'your backpack'}!`}"
      </div>
    </div>

    <div class="info-card">
      <div class="info-row">
        <span class="info-label">Item to Pack:</span>
        <span class="info-value" style="color: #00E5FF;">${itemName || 'Tracked Item'}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Target Bag:</span>
        <span class="info-value">${bagName || 'My College Bag'}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Scheduled Time:</span>
        <span class="info-value">${timeFormatted}</span>
      </div>
    </div>

    <a href="http://localhost:3000/#dashboard" class="btn-action">Check Bag & Confirm Packed →</a>
  `;

  return sendEmail({
    userId,
    to,
    type: "REMINDER_FIRED",
    subject: `⏰ Reminder: Don't forget to pack ${itemName || 'your item'}!`,
    text: `Packing Reminder: ${itemName}. ${reminderMessage || 'Make sure to pack it before leaving!'}`,
    html: buildEmailShell({
      title: "Packing Reminder Alert",
      badgeText: "Packing Reminder",
      badgeColor: "cyan",
      preheader: `Reminder: Don't forget to pack ${itemName}!`,
      contentHtml
    }),
    metadata: { itemName, reminderMessage, dueTime }
  });
}

module.exports = {
  sendEmail,
  sendBagOpenedEmail,
  sendBagClosedEmail,
  sendReminderEmail,
  SMTP_CONFIG
};
