const crypto = require("crypto");
function verify(signature, appSecret, rawBody) {
    const expectedSignature = `sha256=${crypto.createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex")}`;
    try {
      const sigBuf = Buffer.from(signature.trim(), "utf8");
      const expBuf = Buffer.from(expectedSignature, "utf8");
      if (sigBuf.length !== expBuf.length) return false;
      return crypto.timingSafeEqual(sigBuf, expBuf);
    } catch (e) {
      return false;
    }
}
const secret = "3073261f3e86af075dfe56fdf6478a26";
const body = '{"test":"hello"}'; // My curl command test
const expected = `sha256=${crypto.createHmac("sha256", secret).update(body).digest("hex")}`;
console.log("Expected sig for test payload:", expected);
console.log("Verify:", verify(expected, secret, body));
