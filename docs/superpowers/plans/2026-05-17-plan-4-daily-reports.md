# 计划 #4：资金日报核心 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development

**Goal:** 实现资金日报的完整 CRUD：每日收支录入、自动余额计算、级联重算、审核状态机（未审→已审→锁定）。完成后员工能录入每日账目，财务能审核，老板能终审锁定。

**Architecture:** 后端 NestJS + Prisma，余额计算集中在 BalanceCalculatorService，审核状态机集中在 AuditService。前端 Naive UI 列表页 + 录入弹窗（含实时余额预览）。

---

## 数据库表

```prisma
model DailyFundsReport {
  id                   String   @id @default(uuid()) @db.Uuid
  shopId               String   @map("shop_id") @db.Uuid
  reportDate           DateTime @map("report_date") @db.Date

  // 公式参与字段
  openingBalance       Decimal  @default(0) @map("opening_balance") @db.Decimal(14, 2)
  revenue              Decimal  @default(0) @db.Decimal(14, 2)
  cardFee              Decimal  @default(0) @map("card_fee") @db.Decimal(14, 2)
  actualRevenue        Decimal  @default(0) @map("actual_revenue") @db.Decimal(14, 2)
  transferToCompany    Decimal  @default(0) @map("transfer_to_company") @db.Decimal(14, 2)
  depositToCompany     Decimal  @default(0) @map("deposit_to_company") @db.Decimal(14, 2)
  payToOwner           Decimal  @default(0) @map("pay_to_owner") @db.Decimal(14, 2)
  shopExpense          Decimal  @default(0) @map("shop_expense") @db.Decimal(14, 2)
  closingBalance       Decimal  @default(0) @map("closing_balance") @db.Decimal(14, 2)

  // 扩展字段（暂不入余额公式，待业务方确认）
  topupIncome          Decimal  @default(0) @map("topup_income") @db.Decimal(14, 2)
  mallSettlement       Decimal  @default(0) @map("mall_settlement") @db.Decimal(14, 2)
  otherCompanyIncome   Decimal  @default(0) @map("other_company_income") @db.Decimal(14, 2)
  companyToOwner       Decimal  @default(0) @map("company_to_owner") @db.Decimal(14, 2)
  cardPayment          Decimal  @default(0) @map("card_payment") @db.Decimal(14, 2)
  companyBonus         Decimal  @default(0) @map("company_bonus") @db.Decimal(14, 2)

  remark               String?  @db.VarChar(500)
  status               ReportStatus @default(pending)

  createdBy            String   @map("created_by") @db.Uuid
  auditedBy            String?  @map("audited_by") @db.Uuid
  auditedAt            DateTime? @map("audited_at") @db.Timestamptz
  lockedBy             String?  @map("locked_by") @db.Uuid
  lockedAt             DateTime? @map("locked_at") @db.Timestamptz
  createdAt            DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt            DateTime @updatedAt @map("updated_at") @db.Timestamptz

  shop        Shop              @relation(...)
  createdByUser User            @relation("ReportCreator", ...)
  attachments ReportAttachment[]
  auditLogs   AuditLog[]

  @@unique([shopId, reportDate])
  @@index([shopId, reportDate])
  @@map("daily_funds_reports")
}

enum ReportStatus {
  pending   // 未审
  audited   // 已审
  locked    // 锁定
}

model ReportAttachment {
  id         String   @id @default(uuid()) @db.Uuid
  reportId   String   @map("report_id") @db.Uuid
  fieldName  String   @map("field_name") @db.VarChar(100)
  url        String   @db.VarChar(500)
  fileName   String   @map("file_name") @db.VarChar(200)
  fileSize   Int      @map("file_size")
  uploadedBy String   @map("uploaded_by") @db.Uuid
  uploadedAt DateTime @default(now()) @map("uploaded_at") @db.Timestamptz
  deletedAt  DateTime? @map("deleted_at") @db.Timestamptz

  report DailyFundsReport @relation(...)
  @@map("report_attachments")
}

model AuditLog {
  id         String   @id @default(uuid()) @db.Uuid
  reportId   String   @map("report_id") @db.Uuid
  operatorId String   @map("operator_id") @db.Uuid
  action     AuditAction
  fromStatus String?  @map("from_status") @db.VarChar(20)
  toStatus   String?  @map("to_status") @db.VarChar(20)
  diff       Json?
  comment    String?  @db.VarChar(500)
  createdAt  DateTime @default(now()) @map("created_at") @db.Timestamptz

  report DailyFundsReport @relation(...)
  @@map("audit_logs")
}

enum AuditAction {
  submit
  edit
  audit
  reject
  lock
  unlock
}
```

## 余额公式

```
actualRevenue  = revenue - cardFee
closingBalance = openingBalance + actualRevenue - transferToCompany - depositToCompany - payToOwner - shopExpense
```

## 任务列表

| Task | 内容                                                      |
| ---- | --------------------------------------------------------- |
| T1   | Prisma schema + migrate                                   |
| T2   | BalanceCalculatorService（TDD，公式唯一源）               |
| T3   | DailyReportsService（CRUD + 期初余额自动带入 + 级联重算） |
| T4   | AuditService（状态机：pending→audited→locked）            |
| T5   | DailyReportsController + e2e 测试                         |
| T6   | 前端 API client + 列表页 + 录入弹窗                       |
