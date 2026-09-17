-- CreateEnum
CREATE TYPE "IntegrationAssetType" AS ENUM ('API', 'WEBHOOK', 'PIXEL', 'FORM', 'PAGE', 'AD', 'CAMPAIGN', 'CUSTOM', 'OTHER');

-- CreateEnum
CREATE TYPE "AssignmentStrategy" AS ENUM ('SPECIFIC_USER', 'TEAM', 'ROUND_ROBIN', 'FALLBACK');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('ASSIGNED', 'UNASSIGNED', 'FAILED');

-- CreateEnum
CREATE TYPE "AssignmentTrigger" AS ENUM ('LEAD_CREATED', 'MANUAL_ASSIGNMENT', 'REASSIGNMENT', 'SYSTEM_RETRY');

-- DropIndex
-- DROP INDEX "integration_assets_integration_id_asset_type_external_id_key";

-- AlterTable
ALTER TABLE "integration_assets" DROP COLUMN "external_id",
DROP COLUMN "provider",
ADD COLUMN     "external_asset_id" TEXT NOT NULL,
DROP COLUMN "asset_type",
ADD COLUMN     "asset_type" "IntegrationAssetType" NOT NULL;

-- CreateTable
CREATE TABLE "teams" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_teams" (
    "user_id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_teams_pkey" PRIMARY KEY ("user_id","team_id")
);

-- CreateTable
CREATE TABLE "lead_assignment_rules" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priority" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "strategy" "AssignmentStrategy" NOT NULL,
    "target_user_id" UUID,
    "target_team_id" UUID,
    "cursor" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_assignment_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_assignments" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "assigned_user_id" UUID,
    "assigned_team_id" UUID,
    "rule_id" UUID,
    "strategy" "AssignmentStrategy" NOT NULL,
    "trigger" "AssignmentTrigger" NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
    "reason" TEXT,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "teams_company_id_idx" ON "teams"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "teams_company_id_name_key" ON "teams"("company_id", "name");

-- CreateIndex
CREATE INDEX "user_teams_company_id_idx" ON "user_teams"("company_id");

-- CreateIndex
CREATE INDEX "lead_assignment_rules_company_id_enabled_priority_idx" ON "lead_assignment_rules"("company_id", "enabled", "priority");

-- CreateIndex
CREATE INDEX "lead_assignments_company_id_idx" ON "lead_assignments"("company_id");

-- CreateIndex
CREATE INDEX "lead_assignments_assigned_user_id_idx" ON "lead_assignments"("assigned_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "lead_assignments_lead_id_trigger_key" ON "lead_assignments"("lead_id", "trigger");

-- CreateIndex
CREATE UNIQUE INDEX "integration_assets_integration_id_asset_type_external_asset_key" ON "integration_assets"("integration_id", "asset_type", "external_asset_id");

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_teams" ADD CONSTRAINT "user_teams_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_teams" ADD CONSTRAINT "user_teams_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_teams" ADD CONSTRAINT "user_teams_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_assignment_rules" ADD CONSTRAINT "lead_assignment_rules_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_assignments" ADD CONSTRAINT "lead_assignments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_assignments" ADD CONSTRAINT "lead_assignments_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_assignments" ADD CONSTRAINT "lead_assignments_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "lead_assignment_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

