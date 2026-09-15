const crypto = require("crypto");
function runDiagnostics() {
  console.log("Checking hmac string vs buffer...");
  const secret = "3073261f3e86af075dfe56fdf6478a26";
  const body = '{"test":"hello 🌍"}'; 
  
  // What if we compute hmac using string directly?
  const sig1 = crypto.createHmac("sha256", secret).update(body).digest("hex");
  // What if we explicitly use utf8?
  const sig2 = crypto.createHmac("sha256", secret).update(body, "utf8").digest("hex");
  // What if we convert to buffer first?
  const sig3 = crypto.createHmac("sha256", secret).update(Buffer.from(body, "utf8")).digest("hex");
  
  console.log("String default:", sig1);
  console.log("String utf8:", sig2);
  console.log("Buffer utf8:", sig3);
}
runDiagnostics();
