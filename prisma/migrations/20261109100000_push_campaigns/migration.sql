CREATE TABLE "PushCampaign" (
    "id" TEXT NOT NULL,
    "adminId" INTEGER NOT NULL,
    "targetUserId" INTEGER,
    "imageId" TEXT,
    "imageUrl" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "estimatedDevices" INTEGER NOT NULL,
    "lastDeviceId" INTEGER NOT NULL,
    "cursor" INTEGER NOT NULL DEFAULT 0,
    "accepted" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "leaseUntil" TIMESTAMP(3),
    "leaseId" TEXT,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    CONSTRAINT "PushCampaign_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PushCampaign_status_createdAt_idx" ON "PushCampaign"("status", "createdAt");

CREATE TABLE "PushImage" (
    "id" TEXT NOT NULL,
    "adminId" INTEGER NOT NULL,
    "mime" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PushImage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PushImage_expiresAt_idx" ON "PushImage"("expiresAt");
