-- CreateTable
CREATE TABLE "public"."User" (
    "id" SERIAL NOT NULL,
    "telegramId" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "username" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Film" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "posterFileId" TEXT NOT NULL,
    "videoFileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Film_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Order" (
    "id" SERIAL NOT NULL,
    "telegramId" TEXT NOT NULL,
    "filmId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "paymentReference" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Purchase" (
    "id" SERIAL NOT NULL,
    "telegramId" TEXT NOT NULL,
    "filmId" INTEGER NOT NULL,
    "orderId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AdminSession" (
    "id" SERIAL NOT NULL,
    "telegramId" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "filmData" TEXT NOT NULL,

    CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_telegramId_key" ON "public"."User"("telegramId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_paymentReference_key" ON "public"."Order"("paymentReference");

-- CreateIndex
CREATE INDEX "Order_telegramId_idx" ON "public"."Order"("telegramId");

-- CreateIndex
CREATE INDEX "Purchase_telegramId_idx" ON "public"."Purchase"("telegramId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminSession_telegramId_key" ON "public"."AdminSession"("telegramId");

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_telegramId_fkey" FOREIGN KEY ("telegramId") REFERENCES "public"."User"("telegramId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_filmId_fkey" FOREIGN KEY ("filmId") REFERENCES "public"."Film"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Purchase" ADD CONSTRAINT "Purchase_telegramId_fkey" FOREIGN KEY ("telegramId") REFERENCES "public"."User"("telegramId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Purchase" ADD CONSTRAINT "Purchase_filmId_fkey" FOREIGN KEY ("filmId") REFERENCES "public"."Film"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
