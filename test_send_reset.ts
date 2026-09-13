// test_send_reset.ts
import { sendPasswordResetEmail } from "./src/lib/mail";

async function main() {
  const result = await sendPasswordResetEmail({
    name: "Test User",
    email: "mouli.ec109@gmail.com",
    rawToken: "test-token-123",
    baseUrl: "http://localhost",
  });
  console.log('Result:', result);
}

main().catch(err => console.error('Unhandled error:', err));
