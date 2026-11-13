CREATE TABLE "CheckoutPaymentSettings" (
    "id" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "updatedBy" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CheckoutPaymentSettings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CheckoutPaymentSettings_singleton" CHECK ("id" = 1),
    CONSTRAINT "CheckoutPaymentSettings_provider" CHECK ("provider" IN ('paystack', 'flutterwave'))
);
