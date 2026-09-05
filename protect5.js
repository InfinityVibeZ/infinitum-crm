const fs = require('fs');
let file = 'src/app/api/leads/[id]/route.ts';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('import { hasFeature } from "@/lib/subscription"')) {
  content = 'import { hasFeature } from "@/lib/subscription";\n' + content;
}

const authBlock = 'const payload = getTokenPayload(token);\n    if (!payload) return NextResponse.json({ error: "Invalid token" }, { status: 401 });';
const leadsProtectStr = authBlock + '\n\n    if (!(await hasFeature(payload.companyId, "LEADS"))) {\n      return NextResponse.json({ error: "FEATURE_NOT_AVAILABLE", featureCode: "LEADS" }, { status: 403 });\n    }';
const methodDef = 'export async function PUT';
const parts = content.split(methodDef);
if (parts.length >= 2 && !parts[1].includes('"LEADS"')) {
  parts[1] = parts[1].replace(authBlock, leadsProtectStr);
  content = parts.join(methodDef);
}

const lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('if (followUps !== undefined && Array.isArray(followUps)) {')) {
    if (!lines[i+1].includes('hasFeature(payload.companyId, "FOLLOW_UPS")')) {
      lines.splice(i+1, 0, '      if (!(await hasFeature(payload.companyId, "FOLLOW_UPS"))) {', '        return NextResponse.json({ error: "FEATURE_NOT_AVAILABLE", featureCode: "FOLLOW_UPS" }, { status: 403 });', '      }');
    }
  }
  
  if (lines[i].includes('followUpType: "OTHER",') && lines[i+1].includes('status: fu.completed ? "COMPLETED" : "PENDING",') && !lines[i+2].includes('companyId')) {
    lines.splice(i+2, 0, '              companyId: payload.companyId as string,');
  }

  if (lines[i].includes('reason: body.reason || "Manual Status Update",') && lines[i+1].includes('lostReason: body.lostReason || null,') && !lines[i+2].includes('companyId')) {
    lines.splice(i+2, 0, '          companyId: payload.companyId as string,');
  }
}

fs.writeFileSync(file, lines.join('\n'));
console.log('Done protect5');
