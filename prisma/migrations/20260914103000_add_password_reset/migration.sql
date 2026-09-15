ALTER TABLE "WebUser" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "PasswordReset" (
  "id" SERIAL NOT NULL,
  "webUserId" INTEGER NOT NULL,
  "requestTokenHash" TEXT NOT NULL,
  "codeHash" TEXT,
  "telegramId" TEXT,
  "verifiedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PasswordReset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PasswordReset_requestTokenHash_key" ON "PasswordReset"("requestTokenHash");
CREATE INDEX "PasswordReset_webUserId_idx" ON "PasswordReset"("webUserId");
CREATE INDEX "PasswordReset_expiresAt_idx" ON "PasswordReset"("expiresAt");
CREATE INDEX "PasswordReset_usedAt_idx" ON "PasswordReset"("usedAt");

ALTER TABLE "PasswordReset" ADD CONSTRAINT "PasswordReset_webUserId_fkey" FOREIGN KEY ("webUserId") REFERENCES "WebUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
