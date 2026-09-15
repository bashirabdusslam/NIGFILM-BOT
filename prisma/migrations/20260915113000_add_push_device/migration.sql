CREATE TABLE "PushDevice" (
    "id" SERIAL NOT NULL,
    "webUserId" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'android',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushDevice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PushDevice_token_key"
ON "PushDevice"("token");

CREATE INDEX "PushDevice_webUserId_idx"
ON "PushDevice"("webUserId");

CREATE INDEX "PushDevice_enabled_idx"
ON "PushDevice"("enabled");

ALTER TABLE "PushDevice"
ADD CONSTRAINT "PushDevice_webUserId_fkey"
FOREIGN KEY ("webUserId")
REFERENCES "WebUser"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;