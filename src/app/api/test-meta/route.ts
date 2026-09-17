import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';

export async function GET() {
  try {
    const config = await prisma.platformMetaConfiguration.findFirst();

    if (!config) {
      return NextResponse.json(
        { error: 'Meta configuration not found' },
        { status: 404 }
      );
    }

    const appSecret = decrypt(config.encryptedAppSecret);
    const accessToken = `${config.appId}|${appSecret}`;

    const res = await fetch(
      `https://graph.facebook.com/v19.0/${config.instagramConfigId}?access_token=${accessToken}&fields=id,name,login_auth_scopes`
    );

    const data = await res.json();

    return NextResponse.json(data);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}