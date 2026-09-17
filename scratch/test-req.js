const crypto = require("crypto");

// Create a mock Request object
const rawBodyString = '{"test":"hello\r\nworld🚀"}';
const rawBodyBuffer = Buffer.from(rawBodyString, "utf8");

// Simulate Next.js Request which has .clone() and .text()
class MockRequest {
  constructor(buffer) {
    this.buffer = buffer;
  }
  clone() {
    return new MockRequest(this.buffer);
  }
  async text() {
    return this.buffer.toString("utf8");
  }
  async arrayBuffer() {
    return this.buffer.buffer.slice(this.buffer.byteOffset, this.buffer.byteOffset + this.buffer.byteLength);
  }
}

async function run() {
  const req = new MockRequest(rawBodyBuffer);
  const rawBodyText = await req.clone().text();
  const rawBodyBytes = Buffer.from(await req.clone().arrayBuffer());
  
  console.log("Text length:", Buffer.byteLength(rawBodyText, "utf8"));
  console.log("Buffer length:", rawBodyBytes.length);
  console.log("Equal?", rawBodyText === rawBodyBytes.toString("utf8"));
}

run();
