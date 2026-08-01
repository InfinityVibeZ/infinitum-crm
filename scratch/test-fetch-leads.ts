import fs from "fs";
import path from "path";

async function testFetch() {
  try {
    // Make a request to the local API endpoint (we can test directly or test prisma directly)
    const res = await fetch("http://localhost:3000/api/leads", {
      headers: {
        // test without auth or with a test request
      }
    });
    console.log("Response status:", res.status);
    const text = await res.text();
    console.log("Response body:", text.substring(0, 300));
  } catch (err) {
    console.error("Fetch error:", err);
  }
}

testFetch();
