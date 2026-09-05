import {
  PrismaClient,
  BillingInterval,
  FeatureStatus,
  FeatureType,
  PlanStatus,
  PlanType,
} from "@prisma/client";

const prisma = new PrismaClient();

const features = [
  // CRM
  ["DASHBOARD", "Dashboard", FeatureType.CAPABILITY, "CRM"],
  ["CONTACTS", "Contacts", FeatureType.CAPABILITY, "CRM"],
  ["LEADS", "Leads", FeatureType.CAPABILITY, "CRM"],
  ["DEALS", "Deals", FeatureType.CAPABILITY, "CRM"],
  ["ACTIVITIES", "Activities", FeatureType.CAPABILITY, "CRM"],
  ["FOLLOW_UPS", "Follow-ups", FeatureType.CAPABILITY, "CRM"],
  ["TASKS", "Tasks", FeatureType.CAPABILITY, "CRM"],
  ["PIPELINE", "Pipeline", FeatureType.CAPABILITY, "CRM"],

  // Reporting
  ["BASIC_REPORTING", "Basic Reporting", FeatureType.CAPABILITY, "REPORTING"],
  [
    "ADVANCED_REPORTING",
    "Advanced Reporting",
    FeatureType.CAPABILITY,
    "REPORTING",
  ],
  ["CUSTOM_REPORTS", "Custom Reports", FeatureType.CAPABILITY, "REPORTING"],
  ["EXPORT_REPORTS", "Export Reports", FeatureType.CAPABILITY, "REPORTING"],

  // Finance
  ["FINANCE", "Finance", FeatureType.MODULE, "FINANCE"],
  ["INVOICING", "Invoicing", FeatureType.CAPABILITY, "FINANCE"],
  [
    "EXPENSE_MANAGEMENT",
    "Expense Management",
    FeatureType.CAPABILITY,
    "FINANCE",
  ],
  [
    "FINANCIAL_REPORTING",
    "Financial Reporting",
    FeatureType.CAPABILITY,
    "FINANCE",
  ],

  // Documents
  ["DOCUMENTS", "Documents", FeatureType.MODULE, "DOCUMENTS"],
  [
    "DOCUMENT_TEMPLATES",
    "Document Templates",
    FeatureType.CAPABILITY,
    "DOCUMENTS",
  ],
  ["OFFER_MANAGEMENT", "Offer Management", FeatureType.CAPABILITY, "DOCUMENTS"],

  // Analytics
  ["ANALYTICS", "Analytics", FeatureType.MODULE, "ANALYTICS"],
  [
    "ADVANCED_ANALYTICS",
    "Advanced Analytics",
    FeatureType.CAPABILITY,
    "ANALYTICS",
  ],
  ["FORECASTING", "Forecasting", FeatureType.CAPABILITY, "ANALYTICS"],

  // AI
  ["AI_ASSISTANT", "AI Assistant", FeatureType.CAPABILITY, "AI"],
  ["AI_LEAD_SCORING", "AI Lead Scoring", FeatureType.CAPABILITY, "AI"],
  ["AI_DEAL_INSIGHTS", "AI Deal Insights", FeatureType.CAPABILITY, "AI"],
  ["AI_FORECASTING", "AI Forecasting", FeatureType.CAPABILITY, "AI"],

  // Integrations
  ["API_ACCESS", "API Access", FeatureType.SECURITY, "INTEGRATIONS"],
  ["WEBHOOKS", "Webhooks", FeatureType.SECURITY, "INTEGRATIONS"],
  [
    "THIRD_PARTY_INTEGRATIONS",
    "Third-party Integrations",
    FeatureType.CAPABILITY,
    "INTEGRATIONS",
  ],

  // Administration & Security
  ["CUSTOM_FIELDS", "Custom Fields", FeatureType.CAPABILITY, "ADMIN"],
  [
    "ADVANCED_PERMISSIONS",
    "Advanced Permissions",
    FeatureType.SECURITY,
    "ADMIN",
  ],
  ["AUDIT_LOGS", "Audit Logs", FeatureType.SECURITY, "ADMIN"],
  ["SECURITY_SETTINGS", "Security Settings", FeatureType.SECURITY, "ADMIN"],

  // Enterprise Security
  ["SSO", "Single Sign-On", FeatureType.SECURITY, "ENTERPRISE_SECURITY"],
  ["SAML", "SAML", FeatureType.SECURITY, "ENTERPRISE_SECURITY"],
  ["SCIM", "SCIM Provisioning", FeatureType.SECURITY, "ENTERPRISE_SECURITY"],
  ["IP_ALLOWLIST", "IP Allowlist", FeatureType.SECURITY, "ENTERPRISE_SECURITY"],
  [
    "ADVANCED_SECURITY",
    "Advanced Security",
    FeatureType.SECURITY,
    "ENTERPRISE_SECURITY",
  ],
  ["DATA_EXPORT", "Data Export", FeatureType.CAPABILITY, "ENTERPRISE_SECURITY"],
] as const;

const plans = [
  {
    code: "BASIC",
    name: "Basic",
    description: "Essential CRM functionality for small teams.",
    displayOrder: 1,
  },
  {
    code: "INTERMEDIATE",
    name: "Intermediate",
    description: "Advanced CRM, finance, documents and analytics.",
    displayOrder: 2,
  },
  {
    code: "PROFESSIONAL",
    name: "Professional",
    description:
      "Advanced analytics, AI, integrations and enterprise security.",
    displayOrder: 3,
  },
] as const;

const planFeatures: Record<string, string[]> = {
  BASIC: [
    "DASHBOARD",
    "CONTACTS",
    "LEADS",
    "DEALS",
    "ACTIVITIES",
    "FOLLOW_UPS",
    "TASKS",
    "PIPELINE",
    "BASIC_REPORTING",
  ],

  INTERMEDIATE: [
    "DASHBOARD",
    "CONTACTS",
    "LEADS",
    "DEALS",
    "ACTIVITIES",
    "FOLLOW_UPS",
    "TASKS",
    "PIPELINE",
    "BASIC_REPORTING",
    "ADVANCED_REPORTING",
    "FINANCE",
    "INVOICING",
    "EXPENSE_MANAGEMENT",
    "FINANCIAL_REPORTING",
    "DOCUMENTS",
    "DOCUMENT_TEMPLATES",
    "OFFER_MANAGEMENT",
    "ANALYTICS",
    "CUSTOM_FIELDS",
    "ADVANCED_PERMISSIONS",
    "AUDIT_LOGS",
  ],

  PROFESSIONAL: [
    "DASHBOARD",
    "CONTACTS",
    "LEADS",
    "DEALS",
    "ACTIVITIES",
    "FOLLOW_UPS",
    "TASKS",
    "PIPELINE",
    "BASIC_REPORTING",
    "ADVANCED_REPORTING",
    "CUSTOM_REPORTS",
    "EXPORT_REPORTS",
    "FINANCE",
    "INVOICING",
    "EXPENSE_MANAGEMENT",
    "FINANCIAL_REPORTING",
    "DOCUMENTS",
    "DOCUMENT_TEMPLATES",
    "OFFER_MANAGEMENT",
    "ANALYTICS",
    "ADVANCED_ANALYTICS",
    "FORECASTING",
    "AI_ASSISTANT",
    "AI_LEAD_SCORING",
    "AI_DEAL_INSIGHTS",
    "AI_FORECASTING",
    "API_ACCESS",
    "WEBHOOKS",
    "THIRD_PARTY_INTEGRATIONS",
    "CUSTOM_FIELDS",
    "ADVANCED_PERMISSIONS",
    "AUDIT_LOGS",
    "SECURITY_SETTINGS",
    "SSO",
    "SAML",
    "SCIM",
    "IP_ALLOWLIST",
    "ADVANCED_SECURITY",
    "DATA_EXPORT",
  ],
};

async function main() {
  console.log("Seeding subscription plans and features...");

  // FEATURES
  for (const [code, name, featureType, module] of features) {
    const now = new Date();

    await prisma.feature.upsert({
      where: {
        code,
      },

      update: {
        name,
        featureType: featureType,
        module,
        status: FeatureStatus.ACTIVE,
        isVisible: true,
        updatedAt: now,
      },

      create: {
        id: crypto.randomUUID(),
        code,
        name,
        featureType: featureType,
        module,
        status: FeatureStatus.ACTIVE,
        isVisible: true,
        isMetered: false,
        isSystem: false,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  // PLANS
  for (const plan of plans) {
    const now = new Date();

    const createdPlan = await prisma.plan.upsert({
      where: {
        code: plan.code,
      },

      update: {
        name: plan.name,
        description: plan.description,
        status: PlanStatus.ACTIVE,
        displayOrder: plan.displayOrder,
        isPublic: true,
        isDefault: plan.code === "BASIC",
        trialDays: 14,
        billingInterval: BillingInterval.MONTH,
        billingIntervalCount: 1,
        currency: "INR",
        basePrice: 0,
        updatedAt: now,
      },

      create: {
        id: crypto.randomUUID(),
        code: plan.code,
        name: plan.name,
        description: plan.description,
        planType: PlanType.STANDARD,
        status: PlanStatus.ACTIVE,
        displayOrder: plan.displayOrder,
        isPublic: true,
        isDefault: plan.code === "BASIC",
        trialDays: 14,
        billingInterval: BillingInterval.MONTH,
        billingIntervalCount: 1,
        currency: "INR",
        basePrice: 0,
        createdAt: now,
        updatedAt: now,
      },
    });

    // PLAN FEATURES
    for (const featureCode of planFeatures[plan.code]) {
      const feature = await prisma.feature.findUnique({
        where: {
          code: featureCode,
        },
      });

      if (!feature) {
        throw new Error(`Feature not found: ${featureCode}`);
      }

      const nowForPlanFeature = new Date();

      await prisma.planFeature.upsert({
        where: {
          planId_featureId: {
            planId: createdPlan.id,
            featureId: feature.id,
          },
        },

        update: {
          enabled: true,
          updatedAt: nowForPlanFeature,
        },

        create: {
          id: crypto.randomUUID(),
          planId: createdPlan.id,
          featureId: feature.id,
          enabled: true,
          createdAt: nowForPlanFeature,
          updatedAt: nowForPlanFeature,
        },
      });
    }
  }

  console.log("Subscription seed completed successfully.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
