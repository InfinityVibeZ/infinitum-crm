const crypto = require("crypto");

const rawBody = `{"object":"instagram","entry":[{"id":"123","time":123,"messaging":[]}]}`;
let appSecret = "my_secret_with_newline\n";

// Current code logic
const signature = `sha256=${crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
const expectedSignature = `sha256=${crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;

console.log("Current signature matches?", signature === expectedSignature);

// Test with emojis
const rawBodyWithEmoji = `{"text": "Hello 🌍"}`;
const sig1 = crypto.createHmac("sha256", "secret").update(rawBodyWithEmoji).digest("hex");
const sig2 = crypto.createHmac("sha256", "secret").update(Buffer.from(rawBodyWithEmoji, "utf8")).digest("hex");
console.log("Emoji string vs buffer update match?", sig1 === sig2);

