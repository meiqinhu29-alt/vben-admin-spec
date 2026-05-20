-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('pending', 'audited', 'locked');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('submit', 'edit', 'audit', 'reject', 'lock', 'unlock');

-- CreateTable
CREATE TABLE "daily_funds_reports" (
    "id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "report_date" DATE NOT NULL,
    "opening_balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "revenue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "card_fee" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "actual_revenue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "transfer_to_company" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "deposit_to_company" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "pay_to_owner" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "shop_expense" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "closing_balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "topup_income" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "mall_settlement" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "other_company_income" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "company_to_owner" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "card_payment" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "company_bonus" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "remark" VARCHAR(500),
    "status" "ReportStatus" NOT NULL DEFAULT 'pending',
    "created_by" UUID NOT NULL,
    "audited_by" UUID,
    "audited_at" TIMESTAMPTZ,
    "locked_by" UUID,
    "locked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "daily_funds_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_attachments" (
    "id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "field_name" VARCHAR(100) NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "file_name" VARCHAR(200) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "uploaded_by" UUID NOT NULL,
    "uploaded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "report_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "operator_id" UUID NOT NULL,
    "action" "AuditAction" NOT NULL,
    "from_status" VARCHAR(20),
    "to_status" VARCHAR(20),
    "diff" JSONB,
    "comment" VARCHAR(500),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "daily_funds_reports_shop_id_report_date_idx" ON "daily_funds_reports"("shop_id", "report_date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_funds_reports_shop_id_report_date_key" ON "daily_funds_reports"("shop_id", "report_date");

-- CreateIndex
CREATE INDEX "report_attachments_report_id_idx" ON "report_attachments"("report_id");

-- CreateIndex
CREATE INDEX "audit_logs_report_id_idx" ON "audit_logs"("report_id");

-- AddForeignKey
ALTER TABLE "daily_funds_reports" ADD CONSTRAINT "daily_funds_reports_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_funds_reports" ADD CONSTRAINT "daily_funds_reports_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_attachments" ADD CONSTRAINT "report_attachments_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "daily_funds_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_attachments" ADD CONSTRAINT "report_attachments_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "daily_funds_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
