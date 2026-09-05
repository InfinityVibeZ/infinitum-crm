const fs = require('fs');
let file = 'src/app/api/leads/[id]/route.ts';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('import { hasFeature } from "@/lib/subscription"')) {
  content = 'import { hasFeature } from "@/lib/subscription";\n' + content;
}

// 1. LEADS protect
const authBlock = 'const payload = getTokenPayload(token);\n    if (!payload) return NextResponse.json({ error: "Invalid token" }, { status: 401 });';
const leadsProtectStr = authBlock + '\n\n    if (!(await hasFeature(payload.companyId, "LEADS"))) {\n      return NextResponse.json({ error: "FEATURE_NOT_AVAILABLE", featureCode: "LEADS" }, { status: 403 });\n    }';

const methodDef = 'export async function PUT';
const parts = content.split(methodDef);
if (parts.length >= 2 && !parts[1].includes('"LEADS"')) {
  parts[1] = parts[1].replace(authBlock, leadsProtectStr);
  content = parts.join(methodDef);
}

// 2. FOLLOW_UPS protect
const targetFu = 'if (followUps !== undefined && Array.isArray(followUps)) {\n      for (const fu of followUps) {';
const replacementFu = 'if (followUps !== undefined && Array.isArray(followUps)) {\n      if (!(await hasFeature(payload.companyId, "FOLLOW_UPS"))) {\n        return NextResponse.json({ error: "FEATURE_NOT_AVAILABLE", featureCode: "FOLLOW_UPS" }, { status: 403 });\n      }\n      for (const fu of followUps) {';
content = content.replace(targetFu, replacementFu);

// 3. companyId adds
content = content.replace(
  'followUpType: "OTHER",\n              status: fu.completed ? "COMPLETED" : "PENDING",\n            }',
  'followUpType: "OTHER",\n              status: fu.completed ? "COMPLETED" : "PENDING",\n              companyId: payload.companyId as string,\n            }'
);

content = content.replace(
  'reason: body.reason || "Manual Status Update",\n          lostReason: body.lostReason || null,\n        }',
  'reason: body.reason || "Manual Status Update",\n          lostReason: body.lostReason || null,\n          companyId: payload.companyId as string,\n        }'
);

fs.writeFileSync(file, content);
console.log('Done protect4');
