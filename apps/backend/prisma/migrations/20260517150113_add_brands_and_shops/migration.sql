-- CreateEnum
CREATE TYPE "BrandStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "ShopStatus" AS ENUM ('active', 'inactive');

-- CreateTable
CREATE TABLE "brands" (
    "id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "logo_url" VARCHAR(500),
    "status" "BrandStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shops" (
    "id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "brand_id" UUID NOT NULL,
    "initial_balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "address" VARCHAR(500),
    "contact_name" VARCHAR(100),
    "contact_phone" VARCHAR(50),
    "status" "ShopStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "shops_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "brands_code_key" ON "brands"("code");

-- CreateIndex
CREATE UNIQUE INDEX "shops_code_key" ON "shops"("code");

-- CreateIndex
CREATE INDEX "shops_brand_id_idx" ON "shops"("brand_id");

-- AddForeignKey
ALTER TABLE "user_shop_access" ADD CONSTRAINT "user_shop_access_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shops" ADD CONSTRAINT "shops_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
