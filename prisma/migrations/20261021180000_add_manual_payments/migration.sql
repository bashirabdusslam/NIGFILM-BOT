CREATE TABLE "ManualPaymentSettings" (
 "id" INTEGER NOT NULL PRIMARY KEY, "enabled" BOOLEAN NOT NULL DEFAULT false,
 "bankName" TEXT NOT NULL, "accountName" TEXT NOT NULL, "accountNumber" TEXT NOT NULL,
 "instructions" TEXT NOT NULL DEFAULT '', "updatedBy" INTEGER NOT NULL, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "ManualAccessRequest" (
 "id" TEXT NOT NULL PRIMARY KEY, "requestKey" TEXT NOT NULL, "reference" TEXT NOT NULL,
 "webUserId" INTEGER NOT NULL, "kind" TEXT NOT NULL, "filmId" INTEGER, "plan" TEXT,
 "title" TEXT NOT NULL, "amount" INTEGER NOT NULL, "durationDays" INTEGER,
 "status" TEXT NOT NULL DEFAULT 'PENDING_PAYMENT', "source" TEXT NOT NULL DEFAULT 'USER',
 "bankName" TEXT, "accountName" TEXT, "accountNumber" TEXT, "instructions" TEXT,
 "payerName" TEXT, "verifiedTransferReference" TEXT, "transferReference" TEXT, "userNote" TEXT, "reviewNote" TEXT,
 "createdBy" INTEGER, "reviewedBy" INTEGER,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "submittedAt" TIMESTAMP(3),
 "reviewedAt" TIMESTAMP(3), "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "ManualAccessRequest_requestKey_key" ON "ManualAccessRequest"("requestKey");
CREATE UNIQUE INDEX "ManualAccessRequest_reference_key" ON "ManualAccessRequest"("reference");
CREATE INDEX "ManualAccessRequest_webUserId_createdAt_idx" ON "ManualAccessRequest"("webUserId", "createdAt");
CREATE INDEX "ManualAccessRequest_status_createdAt_idx" ON "ManualAccessRequest"("status", "createdAt");
CREATE UNIQUE INDEX "ManualAccessRequest_verifiedTransferReference_key" ON "ManualAccessRequest"("verifiedTransferReference");
