const fs = require('fs');
let file = 'src/app/api/leads/[id]/route.ts';
let content = fs.readFileSync(file, 'utf8');

const targetStr = 'if (followUps !== undefined && Array.isArray(followUps)) {';
const replacementStr = targetStr + '\n      if (!(await hasFeature(payload.companyId, "FOLLOW_UPS"))) {\n        return NextResponse.json({ error: "FEATURE_NOT_AVAILABLE", featureCode: "FOLLOW_UPS" }, { status: 403 });\n      }';

if (!content.includes('"FOLLOW_UPS"')) {
  content = content.replace(targetStr, replacementStr);
  fs.writeFileSync(file, content);
  console.log('FOLLOW_UPS protected');
}
