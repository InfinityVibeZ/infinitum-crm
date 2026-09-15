const fs = require('fs');
const schema = fs.readFileSync('prisma/schema.prisma', 'utf8');
const leadModel = schema.match(/model Lead \{[\s\S]*?\}/);
console.log(leadModel ? leadModel[0] : 'Lead not found');
