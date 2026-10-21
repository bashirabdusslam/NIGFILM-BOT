CREATE TABLE "BillstackPayment" (
 "id" SERIAL PRIMARY KEY, "orderReference" TEXT NOT NULL, "kind" TEXT NOT NULL,
 "webUserId" INTEGER NOT NULL, "expectedKobo" INTEGER NOT NULL,
 "tokenHash" TEXT NOT NULL, "accountReference" TEXT, "accountNumber" TEXT,
 "accountName" TEXT, "bankName" TEXT, "status" TEXT NOT NULL DEFAULT 'CREATING',
 "returnTo" TEXT NOT NULL DEFAULT 'web', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "BillstackPayment_orderReference_key" ON "BillstackPayment"("orderReference");
CREATE UNIQUE INDEX "BillstackPayment_tokenHash_key" ON "BillstackPayment"("tokenHash");
CREATE UNIQUE INDEX "BillstackPayment_accountReference_key" ON "BillstackPayment"("accountReference");
CREATE INDEX "BillstackPayment_webUserId_idx" ON "BillstackPayment"("webUserId");
CREATE TABLE "BillstackReceipt" (
 "id" SERIAL PRIMARY KEY, "sessionId" TEXT NOT NULL, "paymentId" INTEGER NOT NULL,
 "amountKobo" INTEGER NOT NULL, "status" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "BillstackReceipt_sessionId_key" ON "BillstackReceipt"("sessionId");
CREATE INDEX "BillstackReceipt_paymentId_idx" ON "BillstackReceipt"("paymentId");
ALTER TABLE "BillstackReceipt" ADD CONSTRAINT "BillstackReceipt_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "BillstackPayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
