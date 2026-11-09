-- AlterTable
ALTER TABLE "public"."Film" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "public"."AppSettings" (
    "id" INTEGER NOT NULL,
    "whatsappNumber" TEXT NOT NULL DEFAULT '',
    "paymentGateway" TEXT NOT NULL DEFAULT 'PAYSTACK',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AdminAudit" (
    "id" SERIAL NOT NULL,
    "adminId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FilmComment" (
    "id" SERIAL NOT NULL,
    "filmId" INTEGER NOT NULL,
    "webUserId" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FilmComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CheckoutPayment" (
    "reference" TEXT NOT NULL,
    "gateway" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "webUserId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "returnTo" TEXT NOT NULL DEFAULT 'web',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckoutPayment_pkey" PRIMARY KEY ("reference")
);

-- CreateIndex
CREATE INDEX "AdminAudit_createdAt_idx" ON "public"."AdminAudit"("createdAt");

-- CreateIndex
CREATE INDEX "FilmComment_filmId_id_idx" ON "public"."FilmComment"("filmId", "id");

-- CreateIndex
CREATE INDEX "FilmComment_webUserId_createdAt_idx" ON "public"."FilmComment"("webUserId", "createdAt");

-- CreateIndex
CREATE INDEX "CheckoutPayment_webUserId_idx" ON "public"."CheckoutPayment"("webUserId");

-- AddForeignKey
ALTER TABLE "public"."FilmComment" ADD CONSTRAINT "FilmComment_filmId_fkey" FOREIGN KEY ("filmId") REFERENCES "public"."Film"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FilmComment" ADD CONSTRAINT "FilmComment_webUserId_fkey" FOREIGN KEY ("webUserId") REFERENCES "public"."WebUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

