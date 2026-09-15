-- DropIndex
DROP INDEX "integration_assets_integration_id_asset_type_external_asset_key";

-- AlterTable
ALTER TABLE "integration_assets" DROP COLUMN "external_asset_id",
ADD COLUMN     "external_id" TEXT NOT NULL,
ADD COLUMN     "provider" TEXT NOT NULL,
DROP COLUMN "asset_type",
ADD COLUMN     "asset_type" TEXT NOT NULL;

-- DropEnum
DROP TYPE "IntegrationAssetType";

-- CreateIndex
CREATE UNIQUE INDEX "integration_assets_integration_id_asset_type_external_id_key" ON "integration_assets"("integration_id", "asset_type", "external_id");

