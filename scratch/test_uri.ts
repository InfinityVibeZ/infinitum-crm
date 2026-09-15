const requestUrl = "https://localhost:3000/api/settings/integrations/meta/callback?code=AQB123&state=abc";
const url = new URL(requestUrl);
const protocol = url.protocol.replace(':', '');
const host = url.host;
const redirectUri = `${protocol}://${host}/api/settings/integrations/meta/callback`;
console.log("Constructed:", redirectUri);
