const fs = require('fs');
let envStr = '';
try { envStr = fs.readFileSync('.env', 'utf8'); } catch(e) {}
try { envStr += '\n' + fs.readFileSync('.env.local', 'utf8'); } catch(e) {}
const keyLine = envStr.split('\n').find(l => l.startsWith('SMTP_ENCRYPTION_KEY='));
const encKey = keyLine.split('=')[1].trim();

const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const ENCRYPTION_KEY = Buffer.from(encKey, 'hex');

function decrypt(encryptedText) {
  const textParts = encryptedText.split(':');
  const iv = Buffer.from(textParts.shift(), 'hex');
  const authTag = Buffer.from(textParts.shift(), 'hex');
  const encrypted = Buffer.from(textParts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

async function run() {
  const prisma = new PrismaClient();
  const config = await prisma.platformMetaConfiguration.findFirst();
  const appSecret = decrypt(config.encryptedAppSecret);
  const accessToken = config.appId + '|' + appSecret;
  
  const res = await fetch('https://graph.facebook.com/v19.0/' + config.instagramConfigId + '?access_token=' + accessToken + '&fields=id,name,login_auth_scopes');
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
  
  await prisma.$disconnect();
}
run().catch(console.error);
