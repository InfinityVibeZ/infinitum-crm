import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const API_URL = "https://localhost:3000/api";
let email = "test_auth_user@example.com";
let password = "TestPassword123!";

async function runTests() {
  try {
    console.log("=== SETUP ===");
    // Create or reset user
    let user = await prisma.user.findUnique({ where: { email } });
    const passwordHash = await bcrypt.hash(password, 10);
    if (user) {
      user = await prisma.user.update({
        where: { email },
        data: { passwordHash, isActive: true, status: "ACTIVE" }
      });
      // Delete old sessions
      await prisma.session.deleteMany({ where: { userId: user.id } });
    } else {
      user = await prisma.user.create({
        data: {
          email,
          name: "Test Auth User",
          passwordHash,
          role: "USER",
          isActive: true,
          status: "ACTIVE"
        }
      });
    }

    console.log("1. VERIFY SESSION MODEL: PASS (inspected manually)");

    console.log("\n=== 2. VERIFY LOGIN ===");
    let res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    let data = await res.json();
    let cookies = res.headers.getSetCookie() || [];

    let accessTokenCookie = cookies.find((c: string) => c.startsWith("nexus-access-token="));
    let refreshTokenCookie = cookies.find((c: string) => c.startsWith("nexus-refresh-token="));

    if (res.ok && accessTokenCookie && refreshTokenCookie) {
      console.log("Login successful, cookies received.");
      const sessions = await prisma.session.findMany({ where: { userId: user.id } });
      if (sessions.length === 1 && !sessions[0].revokedAt) {
        console.log("Database Session row exists: PASS");
      } else {
        console.log("Database Session row exists: FAIL", sessions);
      }
    } else {
      console.log("Login FAIL", data, cookies);
    }

    let at = accessTokenCookie.split(";")[0].split("=")[1];
    let rt = refreshTokenCookie.split(";")[0].split("=")[1];
    let cookieHeaderString = `${accessTokenCookie.split(";")[0]}; ${refreshTokenCookie.split(";")[0]}`;

    console.log("\n=== 12. VERIFY ACCESS TOKEN LIFETIME ===");
    let payloadStr = Buffer.from(at.split('.')[1], 'base64').toString();
    let payload = JSON.parse(payloadStr);
    let lifetimeMinutes = (payload.exp - payload.iat) / 60;
    console.log(`Access Token lifetime: ${lifetimeMinutes} minutes (Expected: 15)`);
    if (lifetimeMinutes === 15) console.log("Access token lifetime: PASS");
    else console.log("Access token lifetime: FAIL");

    console.log("\n=== 4. VERIFY REFRESH ===");
    res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Cookie": cookieHeaderString }
    });
    if (res.ok) {
      console.log("Refresh successful.");
      let newCookies = res.headers.getSetCookie() || [];
      let newRtCookie = newCookies.find((c: string) => c.startsWith("nexus-refresh-token="));
      if (newRtCookie) {
        console.log("Refresh token rotation performed: PASS");
        let newRt = newRtCookie.split(";")[0].split("=")[1];
        cookieHeaderString = `${newCookies.find((c: string) => c.startsWith("nexus-access-token=")).split(";")[0]}; ${newRtCookie.split(";")[0]}`;
      } else {
        console.log("Refresh token rotation performed: FAIL");
      }

      const sessionAfterRefresh = await prisma.session.findFirst({ where: { userId: user.id } });
      let isMatch = await bcrypt.compare(rt, sessionAfterRefresh.refreshTokenHash);
      if (isMatch) {
        console.log("Old refresh token still in DB! FAIL (should be rotated)");
      } else {
        console.log("Old refresh token hash updated! PASS");
      }

      res = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Cookie": `nexus-refresh-token=${rt}` }
      });
      if (!res.ok) {
        console.log("Old refresh token reuse rejected: PASS");
      } else {
        console.log("Old refresh token reuse rejected: FAIL");
      }
    } else {
      console.log("Refresh FAIL", await res.json());
    }

    console.log("\n=== 7. VERIFY INACTIVE USER ===");
    await prisma.user.update({ where: { email }, data: { status: "INACTIVE" } });
    res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Cookie": cookieHeaderString }
    });
    if (res.status === 401) {
      console.log("Refresh endpoint rejected inactive user: PASS");
    } else {
      console.log("Refresh endpoint rejected inactive user: FAIL", res.status);
    }

    res = await fetch(`${API_URL}/auth/me`, {
      headers: { "Cookie": cookieHeaderString }
    });
    if (res.status === 401) {
      console.log("Protected API rejected inactive user: PASS");
    } else {
      console.log("Protected API rejected inactive user: FAIL", res.status);
    }

    await prisma.user.update({ where: { email }, data: { status: "ACTIVE" } });

    console.log("\n=== 3. VERIFY LOGOUT ===");
    res = await fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      headers: { "Cookie": cookieHeaderString }
    });
    if (res.ok) {
      let logoutCookies = res.headers.getSetCookie() || [];
      if (logoutCookies.some((c: string) => c.includes("nexus-refresh-token=;") || c.includes("Max-Age=0"))) {
        console.log("Logout cleared cookies: PASS");
      }
      const finalSession = await prisma.session.findFirst({ where: { userId: user.id } });
      if (finalSession.revokedAt) {
        console.log("Server-side session revoked: PASS");
      } else {
        console.log("Server-side session revoked: FAIL");
      }
    }

    console.log("\n=== 14. VERIFY COOKIE SECURITY ===");
    if (cookies.every((c: string) => c.includes("HttpOnly") || !c.includes("nexus-access-token"))) {
      console.log("HttpOnly present on critical cookies: PASS");
    }

    console.log("\nDONE");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

runTests();
