const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSchema() {
  const models = Prisma.dmmf.datamodel.models;
  const configModel = models.find(m => m.name === 'PlatformMetaConfiguration');
  console.log("Fields in PlatformMetaConfiguration:");
  configModel.fields.forEach(f => console.log(` - ${f.name} (${f.type})`));
  
  const intModel = models.find(m => m.name === 'Integration');
  console.log("\nFields in Integration:");
  intModel.fields.forEach(f => {
    if(f.name.toLowerCase().includes('secret') || f.name.toLowerCase().includes('token')) {
      console.log(` - ${f.name} (${f.type})`);
    }
  });
}
checkSchema();
