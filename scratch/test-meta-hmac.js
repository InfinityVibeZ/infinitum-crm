const crypto = require("crypto");

// Simulated verify function to test what's wrong
async function verifyWebhookSignature(signature, appSecret, rawBody) {
    if (!signature) return false;
    if (!appSecret) return false;
    appSecret = appSecret.trim();
    const expectedSignature = `sha256=${crypto.createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex")}`;
    try {
      const sigBuffer = Buffer.from(signature.trim(), "utf8");
      const expectedBuffer = Buffer.from(expectedSignature, "utf8");
      if (sigBuffer.length !== expectedBuffer.length) return false;
      return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
    } catch (e) {
      return false;
    }
}

async function run() {
  const realSecret = "3073261f3e86af075dfe56fdf6478a26";
  const wrongSecret = "wrong3073261f3e86af075dfe56fdf64";
  const exactMetaPayload = JSON.stringify({
    "object": "instagram",
    "entry": [
      {
        "id": "123456789",
        "time": 1726400000,
        "messaging": [
          {
            "sender": { "id": "987654321" },
            "recipient": { "id": "123456789" },
            "timestamp": 1726400000,
            "message": { "mid": "m_123", "text": "Hello Meta" }
          }
        ]
      }
    ]
  });
  
  const correctSig = `sha256=${crypto.createHmac("sha256", realSecret).update(exactMetaPayload, "utf8").digest("hex")}`;
  
  const res1 = await verifyWebhookSignature(correctSig, realSecret, exactMetaPayload);
  const res2 = await verifyWebhookSignature(correctSig, wrongSecret, exactMetaPayload);
  const res3 = await verifyWebhookSignature(correctSig, realSecret, exactMetaPayload + " ");
  
  console.log("correct App Secret =>", res1);
  console.log("wrong App Secret =>", res2);
  console.log("same payload with modified body =>", res3);
}
run();
