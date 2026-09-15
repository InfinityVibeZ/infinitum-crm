const { PrismaClient, FeatureType } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  let feature = await prisma.feature.findUnique({ where: { code: 'CRM_LEADS' } });
  if (!feature) {
    feature = await prisma.feature.create({
      data: {
        code: 'CRM_LEADS',
        name: 'CRM Leads',
        description: 'Lead Management',
        featureType: 'MODULE'
      }
    });
    console.log("Created feature CRM_LEADS");
  }
  const plans = await prisma.plan.findMany();
  for (const plan of plans) {
    const existingFeature = await prisma.planFeature.findFirst({
      where: { planId: plan.id, featureId: feature.id }
    });
    if (existingFeature) {
      await prisma.planFeature.update({
        where: { id: existingFeature.id },
        data: { enabled: true }
      });
    } else {
      await prisma.planFeature.create({
        data: { planId: plan.id, featureId: feature.id, enabled: true }
      });
    }
    console.log(`Force updated PlanFeature for plan ${plan.name}`);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
