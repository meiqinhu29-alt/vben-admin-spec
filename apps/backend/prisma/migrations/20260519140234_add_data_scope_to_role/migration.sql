-- CreateEnum
CREATE TYPE "DataScope" AS ENUM ('all', 'shop', 'self');

-- AlterTable
ALTER TABLE "roles" ADD COLUMN     "data_scope" "DataScope" NOT NULL DEFAULT 'all';
