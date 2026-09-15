-- CreateEnum
CREATE TYPE "ContactIdentityType" AS ENUM ('EMAIL', 'PHONE', 'PROVIDER_EXTERNAL_ID', 'SOCIAL_PROFILE', 'WEBSITE_USER', 'OTHER');

-- DropIndex
DROP INDEX "contacts_company_id_email_key";

-- AlterTable
ALTER TABLE "contact_identities" ADD COLUMN     "identity_type" "ContactIdentityType" NOT NULL DEFAULT 'PROVIDER_EXTERNAL_ID',
ADD COLUMN     "metadata" JSONB,
ALTER COLUMN "integration_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "contacts" ADD COLUMN     "normalized_email" TEXT,
ADD COLUMN     "normalized_phone" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "contacts_company_id_normalized_email_key" ON "contacts"("company_id", "normalized_email");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_company_id_normalized_phone_key" ON "contacts"("company_id", "normalized_phone");
