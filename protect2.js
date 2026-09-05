const fs = require('fs');

const protect = (file, method, featureCode) => {
  if (!fs.existsSync(file)) return console.log('Not found:', file);
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('hasFeature')) return console.log('Already protected:', file);

  const importStr = 'import { hasFeature } from "@/lib/subscription";\n';
  content = importStr + content;

  const authBlock = 'const payload = getTokenPayload(token);\n    if (!payload) return NextResponse.json({ error: "Invalid token" }, { status: 401 });';
  
  const protectStr = authBlock + '\n\n    if (!(await hasFeature(payload.companyId, "' + featureCode + '"))) {\n      return NextResponse.json({ error: "FEATURE_NOT_AVAILABLE", featureCode: "' + featureCode + '" }, { status: 403 });\n    }';

  const methodDef = 'export async function ' + method;
  const parts = content.split(methodDef);
  if (parts.length < 2) return console.log('Method not found:', method, file);

  parts[1] = parts[1].replace(authBlock, protectStr);
  
  fs.writeFileSync(file, parts.join(methodDef));
  console.log('Protected:', file, method, featureCode);
};

protect('src/app/api/leads/[id]/route.ts', 'PUT', 'LEADS');
