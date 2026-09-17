// scripts/verify-smtp.ts
import 'dotenv/config';
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
    try { pass = decrypt(pass); } catch (e) { console.warn('[SMTP] Decryption failed'); }
  }
  const cleanPass = (pass || '').replace(/\s+/g, '');
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: false,
    requireTLS: true,
    auth: { user, pass: cleanPass },
    tls: { rejectUnauthorized: false },
  });
  transporter.verify((error, success) => {
    if (error) {
      console.log('VERIFY_ERROR', {
        code: (error as any).code,
        command: (error as any).command,
        responseCode: (error as any).responseCode,
        response: (error as any).response,
      });
    } else {
      console.log('VERIFY_SUCCESS', success);
    }
    process.exit();
  });
})();
