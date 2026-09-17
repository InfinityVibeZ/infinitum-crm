// scripts/capture_smtp_info.ts
// No dotenv import needed
import nodemailer from 'nodemailer';
import { getApiKey } from '../src/lib/config';
import { decrypt } from '../src/lib/encryption';

(async () => {
  const host = await getApiKey('SMTP_HOST');
  const portStr = await getApiKey('SMTP_PORT');
  const port = parseInt(portStr || '587', 10);
  const user = await getApiKey('SMTP_USER');
  let pass = await getApiKey('SMTP_PASS');
  if (process.env.SMTP_ENCRYPTION_KEY && typeof pass === 'string' && pass.includes(':')) {
    try { pass = decrypt(pass); } catch (e) { console.warn('Decrypt failed'); }
  }
  const cleanPass = (pass || '').replace(/\s+/g, '');
  const fromEmail = await getApiKey('SMTP_FROM');
  const fromName = await getApiKey('SMTP_FROM_NAME');
  const from = fromEmail
    ? fromEmail.includes('<')
      ? fromEmail
      : `"${fromName}" <${fromEmail}>`
    : `"${fromName}" <no-reply@infinityvibez.com>`;
  const to = 'mouli.ec109@gmail.com';
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass: cleanPass },
    tls: { rejectUnauthorized: false },
  });
  try {
    const info = await transporter.sendMail({ from, to, subject: 'SMTP Info Capture', text: 'capture test' });
    console.log('SEND_INFO', JSON.stringify(info, null, 2));
  } catch (err) {
    console.error('SEND_ERROR', err);
  }
})();
