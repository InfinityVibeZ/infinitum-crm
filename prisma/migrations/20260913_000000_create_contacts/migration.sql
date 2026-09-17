CREATE TABLE "contacts" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "company" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "owner_id" UUID,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contact_identities" (

    "id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "integration_id" UUID NOT NULL,
    "external_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_identities_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "contacts_company_id_phone_idx" ON "contacts"("company_id", "phone");
CREATE INDEX "contacts_company_id_idx" ON "contacts"("company_id");

ALTER TABLE "contacts" ADD CONSTRAINT "contacts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contact_identities" ADD CONSTRAINT "contact_identities_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "integration_assets" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "integration_id" UUID NOT NULL,
    "asset_type" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "integration_assets_pkey" PRIMARY KEY ("id")
);
