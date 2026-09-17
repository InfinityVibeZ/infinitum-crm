const fs = require('fs');
const path = require('path');
const p = path.resolve(__dirname, '../src/app/api/leads/route.ts');
let content = fs.readFileSync(p, 'utf8');

content = content.replace(
  'const featureError = await requireFeature(payload.companyId, "CRM_LEADS");',
  'const featureError = await requireFeature(authUser.companyId, "CRM_LEADS");'
);

content = content.replace(
  'companyId: payload.companyId as string,',
  'companyId: authUser.companyId as string,'
);

content = content.replace(
  'companyId: payload.companyId as string,',
  'companyId: authUser.companyId as string,'
);

fs.writeFileSync(p, content);
console.log('Fixed leads route');
