-- CreateEnum
CREATE TYPE "AttributionPlatform" AS ENUM ('META', 'GOOGLE', 'TIKTOK', 'LINKEDIN', 'WEBSITE', 'ORGANIC', 'REFERRAL', 'MANUAL', 'IMPORT', 'OTHER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "AttributionChannel" AS ENUM ('FACEBOOK', 'INSTAGRAM', 'SEARCH', 'DISPLAY', 'WEBSITE', 'EMAIL', 'REFERRAL', 'DIRECT', 'OTHER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "AttributionSourceType" AS ENUM ('LEAD_AD', 'WEBSITE_FORM', 'ORGANIC', 'REFERRAL', 'MANUAL', 'IMPORT', 'API', 'UNKNOWN');

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "conversion_touch_id" UUID,
ADD COLUMN     "first_touch_id" UUID,
ADD COLUMN     "last_touch_id" UUID;

-- CreateTable
CREATE TABLE "attribution_touches" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "contact_id" UUID,
    "lead_id" UUID,
    "integration_id" UUID,
    "platform" "AttributionPlatform" NOT NULL DEFAULT 'UNKNOWN',
    "channel" "AttributionChannel" NOT NULL DEFAULT 'UNKNOWN',
    "sourceType" "AttributionSourceType" NOT NULL DEFAULT 'UNKNOWN',
    "campaign_id" TEXT,
    "campaign_name" TEXT,
    "ad_set_id" TEXT,
    "ad_set_name" TEXT,
    "ad_id" TEXT,
    "ad_name" TEXT,
    "creative_id" TEXT,
    "creative_name" TEXT,
    "form_id" TEXT,
    "form_name" TEXT,
    "external_event_id" TEXT,
    "landing_page" TEXT,
    "referrer" TEXT,
    "utm_source" TEXT,
    "utm_medium" TEXT,
    "utm_campaign" TEXT,
    "utm_term" TEXT,
    "utm_content" TEXT,
    "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attribution_touches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attribution_touches_company_id_idx" ON "attribution_touches"("company_id");

-- CreateIndex
CREATE INDEX "attribution_touches_contact_id_idx" ON "attribution_touches"("contact_id");

-- CreateIndex
CREATE INDEX "attribution_touches_lead_id_idx" ON "attribution_touches"("lead_id");

-- CreateIndex
CREATE INDEX "attribution_touches_campaign_id_idx" ON "attribution_touches"("campaign_id");

-- CreateIndex
CREATE UNIQUE INDEX "attribution_touches_company_id_platform_external_event_id_key" ON "attribution_touches"("company_id", "platform", "external_event_id");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_first_touch_id_fkey" FOREIGN KEY ("first_touch_id") REFERENCES "attribution_touches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_last_touch_id_fkey" FOREIGN KEY ("last_touch_id") REFERENCES "attribution_touches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_conversion_touch_id_fkey" FOREIGN KEY ("conversion_touch_id") REFERENCES "attribution_touches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attribution_touches" ADD CONSTRAINT "attribution_touches_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attribution_touches" ADD CONSTRAINT "attribution_touches_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attribution_touches" ADD CONSTRAINT "attribution_touches_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
