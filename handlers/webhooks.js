import crypto from "crypto";

import {
  prisma,
  bot,
} from "../bot.js";

import {
  securelyCompareHashes,
  processPremiumPayment,
  processWebFilmPayment,
  processSingleFilmPayment,
  processCartPayment,
} from "./paymentProcessors.js";

// ======================================================
// REGISTER WEBHOOK HANDLERS
// ======================================================

export default function registerWebhookHandlers(
  app
) {
  // ====================================================
  // PAYSTACK WEBHOOK
  // ====================================================

  app.post(
    "/paystack/webhook",
    async (req, res) => {
      try {
        // ================================================
        // GET PAYSTACK SIGNATURE
        // ================================================

        const signature =
          req.headers[
            "x-paystack-signature"
          ];

        if (
          typeof signature !==
            "string" ||
          !req.rawBody ||
          !process.env
            .PAYSTACK_SECRET_KEY
        ) {
          console.log(
            "❌ Missing Paystack signature, raw body or secret key"
          );

          return res.sendStatus(400);
        }

        // ================================================
        // VERIFY PAYSTACK HMAC
        // ================================================

        const calculatedHash =
          crypto
            .createHmac(
              "sha512",
              process.env
                .PAYSTACK_SECRET_KEY
            )
            .update(req.rawBody)
            .digest("hex");

        if (
          !securelyCompareHashes(
            calculatedHash,
            signature
          )
        ) {
          console.log(
            "❌ Invalid Paystack signature"
          );

          return res.sendStatus(401);
        }

        // ================================================
        // READ EVENT
        // ================================================

        const event =
          req.body;

        // We only process successful charges here.
        if (
          event?.event !==
          "charge.success"
        ) {
          return res.sendStatus(200);
        }

        const reference =
          String(
            event?.data
              ?.reference ||
              ""
          ).trim();

        const metadata =
          event?.data
            ?.metadata || {};

        const paidAmount =
          Number(
            event?.data?.amount
          );

        if (!reference) {
          console.log(
            "❌ Payment reference is missing"
          );

          return res.sendStatus(200);
        }

        console.log(
          "✅ Paystack payment received:",
          reference
        );

        // ================================================
        // PREMIUM SUBSCRIPTION PAYMENT
        // ================================================

        const premiumOrder =
          await prisma
            .premiumOrder
            .findUnique({
              where: {
                paymentReference:
                  reference,
              },
            });

        if (
          premiumOrder ||
          metadata.type ===
            "web_premium_subscription"
        ) {
          const result =
            await processPremiumPayment({
              reference,
              paidAmount,
            });

          if (!result.success) {
            console.error(
              "❌ PREMIUM PAYMENT PROCESS FAILED:",
              result.message
            );

            return res.sendStatus(400);
          }

          console.log(
            "✅ PREMIUM PAYMENT PROCESSED:",
            reference
          );

          return res.sendStatus(200);
        }

        // ================================================
        // WEB APP FILM PAYMENT
        // ================================================

        const webOrder =
          await prisma
            .webOrder
            .findUnique({
              where: {
                paymentReference:
                  reference,
              },
            });

        if (
          webOrder ||
          metadata.type ===
            "web_film_purchase"
        ) {
          const result =
            await processWebFilmPayment({
              reference,
              paidAmount,
            });

          if (!result.success) {
            console.error(
              "❌ WEB PAYMENT PROCESS FAILED:",
              result.message
            );

            return res.sendStatus(400);
          }

          console.log(
            "✅ WEB PAYMENT PROCESSED:",
            reference
          );

          return res.sendStatus(200);
        }

        // ================================================
        // TELEGRAM PAYMENT
        // ================================================

        const order =
          await prisma.order.findUnique({
            where: {
              paymentReference:
                reference,
            },
          });

        if (!order) {
          console.log(
            "❌ Telegram/Web Order not found:",
            reference
          );

          // Return 200 so Paystack does not
          // repeatedly retry an unknown reference.
          return res.sendStatus(200);
        }

        // ================================================
        // VERIFY TELEGRAM PAYMENT AMOUNT
        // ================================================

        const expectedAmount =
          Number(order.amount) *
          100;

        if (
          !Number.isFinite(
            paidAmount
          ) ||
          paidAmount !==
            expectedAmount
        ) {
          console.log(
            "❌ Payment amount mismatch:",
            {
              reference,
              paidAmount,
              expectedAmount,
            }
          );

          return res.sendStatus(400);
        }

        // ================================================
        // IDEMPOTENCY
        // ================================================

        if (
          order.status ===
          "paid"
        ) {
          console.log(
            "ℹ️ Order already processed:",
            reference
          );

          return res.sendStatus(200);
        }

        // ================================================
        // PROCESS TELEGRAM ORDER
        // ================================================

        if (
          metadata.type ===
          "cart_checkout"
        ) {
          await processCartPayment({
            order,
            metadata,
          });
        } else {
          await processSingleFilmPayment({
            order,
          });
        }

        // ================================================
        // PAYMENT CONFIRMATION MESSAGE
        // ================================================

        try {
          await bot.telegram
            .sendMessage(
              order.telegramId,

              "An tabbatar da biyan kudinka cikin nasara.\n\n" +
                "Na gode da amfani da NIGFILM BOT ❤️"
            );
        } catch (
          messageError
        ) {
          console.error(
            "PAYMENT CONFIRMATION MESSAGE ERROR:",
            messageError
          );
        }

        console.log(
          "✅ TELEGRAM PAYMENT PROCESSED:",
          reference
        );

        return res.sendStatus(200);
      } catch (error) {
        console.error(
          "❌ PAYSTACK WEBHOOK ERROR:",
          error
        );

        return res.sendStatus(500);
      }
    }
  );
}