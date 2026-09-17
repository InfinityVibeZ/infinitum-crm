const crypto = require("crypto");
async function checkCloudflareEmoji() {
  const secret = "3073261f3e86af075dfe56fdf6478a26";
  const body = '{"test":"hello 🌍"}'; 
  const sig = `sha256=${crypto.createHmac("sha256", secret).update(Buffer.from(body, "utf8")).digest("hex")}`;

  const res = await fetch("https://consultation-equivalent-minimal-clusters.trycloudflare.com/api/webhooks/integrations/instagram", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-hub-signature-256": sig
    },
    body
  });
  console.log("Emoji test Status:", res.status);
  console.log("Headers:", res.headers.get("x-nexus-webhook-diagnostic"));
}
checkCloudflareEmoji();
