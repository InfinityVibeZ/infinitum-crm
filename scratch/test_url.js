const url = new URL("https://localhost:3000/api/settings/integrations/meta/callback?code=AQB123#_");
console.log("code:", url.searchParams.get("code"));
