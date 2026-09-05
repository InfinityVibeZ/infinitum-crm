const fs = require('fs');
let file = 'src/app/api/leads/[id]/route.ts';
let content = fs.readFileSync(file, 'utf8');

// 1. Add LEADS protection
const authBlock = 'const payload = getTokenPayload(token);\n    if (!payload) return NextResponse.json({ error: "Invalid token" }, { status: 401 });';
const leadsProtectStr = authBlock + '\n\n    if (!(await hasFeature(payload.companyId, "LEADS"))) {\n      return NextResponse.json({ error: "FEATURE_NOT_AVAILABLE", featureCode: "LEADS" }, { status: 403 });\n    }';

if (!content.includes('"LEADS"')) {
  const methodDef = 'export async function PUT';
  const parts = content.split(methodDef);
  if (parts.length >= 2) {
    parts[1] = parts[1].replace(authBlock, leadsProtectStr);
    content = parts.join(methodDef);
  }
}

// 2. Add import if missing
if (!content.includes('hasFeature')) {
  content = 'import { hasFeature } from "@/lib/subscription";\n' + content;
}

// 3. Add FOLLOW_UPS protection
const fuTarget = 'if (followUps !== undefined && Array.isArray(followUps)) {\n      for (const fu of followUps) {';
const fuReplacement = 'if (followUps !== undefined && Array.isArray(followUps)) {\n      if (!(await hasFeature(payload.companyId, "FOLLOW_UPS"))) {\n        return NextResponse.json({ error: "FEATURE_NOT_AVAILABLE", featureCode: "FOLLOW_UPS" }, { status: 403 });\n      }\n      for (const fu of followUps) {';
content = content.replace(fuTarget, fuReplacement);

// 4. Add companyId to FollowUp create
const fuCreateTarget = 'followUpType: "OTHER",\n              status: fu.completed ? "COMPLETED" : "PENDING",\n            },';
const fuCreateReplacement = 'followUpType: "OTHER",\n              status: fu.completed ? "COMPLETED" : "PENDING",\n              companyId: payload.companyId as string,\n            },';
content = content.replace(fuCreateTarget, fuCreateReplacement);

// 5. Add companyId to LeadStatusHistory create
const lshCreateTarget = 'reason: body.reason || "Manual Status Update",\n          lostReason: body.lostReason || null,\n        },';
const lshCreateReplacement = 'reason: body.reason || "Manual Status Update",\n          lostReason: body.lostReason || null,\n          companyId: payload.companyId as string,\n        },';
content = content.replace(lshCreateTarget, lshCreateReplacement);

fs.writeFileSync(file, content);
console.log('Fixed leads/[id]/route.ts');
