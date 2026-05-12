/**
 * lib/email.js — Transactional email sending
 *
 * Priority order:
 *   1. Resend (RESEND_API_KEY)  — recommended, no extra npm package
 *   2. Console log              — dev fallback, tokens printed to stdout
 *
 * Add RESEND_API_KEY to Railway env vars. Get a free key at resend.com
 * (free tier: 3 000 emails/month, 100/day).
 *
 * FROM_EMAIL must be a verified domain/address in Resend.
 * For testing: use the Resend sandbox address or your own domain.
 */

const FROM_NAME  = 'NeutralNachrichten';
const FROM_EMAIL = process.env.FROM_EMAIL  || 'noreply@neutralnachrichten.de';
const BASE_URL   = process.env.BASE_URL    || 'http://localhost:5173';

// ── HTML wrapper matching the newspaper brand ─────────────────────────────────
function template(bodyHtml) {
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>NeutralNachrichten</title>
  <style>
    body{margin:0;padding:0;background:#f5f0ea;font-family:Georgia,'Times New Roman',serif;color:#1a1a1a}
    .wrap{max-width:560px;margin:0 auto;background:#FFF8F0}
    .hd{background:#1a1a1a;padding:22px 40px}
    .hd h1{color:#FFF8F0;font-size:17px;font-weight:900;letter-spacing:3px;text-transform:uppercase;margin:0}
    .hd p{color:#777;font-size:9px;letter-spacing:2px;font-family:Arial,sans-serif;text-transform:uppercase;margin:4px 0 0}
    .strip{height:3px;display:flex}
    .s1{flex:1;background:#e11d48}.s2{flex:1;background:#fb923c}
    .s3{flex:1;background:#94a3b8}.s4{flex:1;background:#0ea5e9}.s5{flex:1;background:#1d4ed8}
    .bd{padding:36px 40px 28px}
    .bd h2{font-size:22px;font-weight:900;margin:0 0 14px;color:#1a1a1a}
    .bd p{font-size:14px;line-height:1.7;color:#444;margin:0 0 14px;font-family:Arial,sans-serif}
    .btn{display:inline-block;background:#1a1a1a;color:#FFF8F0 !important;text-decoration:none;
         padding:14px 32px;font-family:Arial,sans-serif;font-size:11px;font-weight:700;
         letter-spacing:2px;text-transform:uppercase;margin:16px 0}
    .note{font-family:Arial,sans-serif;font-size:11px;color:#999;line-height:1.6;margin:6px 0 0}
    .rule{border:0;border-top:1px solid #e0d8cf;margin:24px 0}
    .ft{padding:18px 40px;border-top:2px solid #1a1a1a;font-family:Arial,sans-serif;font-size:11px;color:#888;line-height:1.6}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="hd">
      <h1>NeutralNachrichten</h1>
      <p>Deutsche Medienanalyse</p>
    </div>
    <div class="strip"><div class="s1"></div><div class="s2"></div><div class="s3"></div><div class="s4"></div><div class="s5"></div></div>
    <div class="bd">${bodyHtml}</div>
    <div class="ft">
      <p>Wenn du diese E-Mail nicht angefordert hast, kannst du sie einfach ignorieren.</p>
      <p>© ${new Date().getFullYear()} NeutralNachrichten &nbsp;·&nbsp; neutralnachrichten.de</p>
    </div>
  </div>
</body>
</html>`;
}

// ── Low-level send ─────────────────────────────────────────────────────────────
async function send({ to, subject, html, text }) {
  // 1 — Resend (fetch, no npm required)
  if (process.env.RESEND_API_KEY) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        text,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Resend API error ${res.status}: ${body}`);
    }
    console.log(`[Email] Sent "${subject}" to ${to}`);
    return;
  }

  // 2 — Dev console fallback
  console.log(`\n📧 [Email] DEV — no RESEND_API_KEY set`);
  console.log(`   To:      ${to}`);
  console.log(`   Subject: ${subject}`);
  console.log(`   ${text}\n`);
}

// ── Public helpers ─────────────────────────────────────────────────────────────

export async function sendVerificationEmail(email, token) {
  const url = `${BASE_URL}/verify-email?token=${token}`;
  await send({
    to: email,
    subject: 'E-Mail-Adresse bestätigen — NeutralNachrichten',
    text: `Bitte bestätige deine E-Mail-Adresse:\n${url}\n\nDieser Link ist 24 Stunden gültig.`,
    html: template(`
      <h2>Fast fertig!</h2>
      <p>Klicke auf den Button, um deine E-Mail-Adresse zu bestätigen und dein Konto zu aktivieren.</p>
      <a href="${url}" class="btn">E-Mail bestätigen</a>
      <hr class="rule">
      <p class="note">Dieser Link ist <strong>24 Stunden</strong> gültig.</p>
      <p class="note">Button funktioniert nicht? Kopiere diesen Link in deinen Browser:<br>${url}</p>
    `),
  });
}

export async function sendPasswordResetEmail(email, token) {
  const url = `${BASE_URL}/reset-password?token=${token}`;
  await send({
    to: email,
    subject: 'Passwort zurücksetzen — NeutralNachrichten',
    text: `Passwort zurücksetzen:\n${url}\n\nDieser Link ist 1 Stunde gültig. Falls du keinen Reset angefragt hast, ignoriere diese E-Mail.`,
    html: template(`
      <h2>Passwort zurücksetzen</h2>
      <p>Du hast einen Passwort-Reset für das Konto <strong>${email}</strong> angefragt.</p>
      <a href="${url}" class="btn">Neues Passwort setzen</a>
      <hr class="rule">
      <p class="note">Dieser Link ist <strong>1 Stunde</strong> gültig und kann nur einmal verwendet werden.</p>
      <p class="note">Falls du keinen Reset angefragt hast, ignoriere diese E-Mail — dein Passwort bleibt unverändert.</p>
    `),
  });
}

export default { sendVerificationEmail, sendPasswordResetEmail };
