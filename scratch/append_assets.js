const fs = require('fs');
const content = `\nCREATE TABLE "integration_assets" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "integration_id" UUID NOT NULL,
    "asset_type" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "integration_assets_pkey" PRIMARY KEY ("id")
);\n`;
fs.appendFileSync('prisma/migrations/20260913_000000_create_contacts/migration.sql', content);
