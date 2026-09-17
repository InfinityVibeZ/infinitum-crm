import { PrismaClient } from '@prisma/client';
import { decrypt } from './src/lib/encryption';

async function run() {
  const prisma = new PrismaClient();
  const config = await prisma.platformMetaConfiguration.findFirst();
  const appSecret = decrypt(config.encryptedAppSecret);
  const accessToken = config.appId + '|' + appSecret;
  
  const res = await fetch('https://graph.facebook.com/v19.0/' + config.appId + '?access_token=' + accessToken + '&fields=business_login_configs');
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
  
  await prisma.$disconnect();
}
run().catch(console.error);
