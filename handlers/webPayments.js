import crypto from "crypto";
import { prisma } from "../bot.js";

export default function registerWebPaymentHandlers(
  app,
  {
    PUBLIC_BASE_URL,
    WEB_APP_URL,
    verifyPaystackTransaction,
    processWebFilmPayment,
    processPremiumPayment,
    buildWebPaymentPage,
  }
) {


// ======================================================
// WEB PAYSTACK PAYMENT INITIALIZE
// ======================================================

app.post(
  "/api/web/payments/initialize",
  async (req, res) => {
    try {
      const webUserId =
        Number(
          req.body?.webUserId
        );

      const filmId =
        Number(
          req.body?.filmId
        );

      if (
        !Number.isInteger(
          webUserId
        ) ||
        webUserId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Web User ID bai dace ba.",
        });
      }

      if (
        !Number.isInteger(
          filmId
        ) ||
        filmId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Film ID bai dace ba.",
        });
      }

      if (
        !process.env
          .PAYSTACK_SECRET_KEY
      ) {
        console.error(
          "âŒ PAYSTACK_SECRET_KEY babu."
        );

        return res.status(500).json({
          success: false,
          message:
            "Paystack bai gama saitawa ba.",
        });
      }

      const user =
        await prisma.webUser.findUnique({
          where: {
            id: webUserId,
          },
        });

      if (!user) {
        return res.status(404).json({
          success: false,
          message:
            "Ba a samu wannan Web User ba.",
        });
      }

      const film =
        await prisma.film.findUnique({
          where: {
            id: filmId,
          },
        });

      if (!film) {
        return res.status(404).json({
          success: false,
          message:
            "Ba a samu wannan film ba.",
        });
      }

      // =================================
      // CHECK PURCHASE
      // =================================

      const existingPurchase =
        await prisma.webPurchase.findUnique({
          where: {
            webUserId_filmId: {
              webUserId:
                user.id,

              filmId:
                film.id,
            },
          },
        });

      if (existingPurchase) {
        return res.status(409).json({
          success: false,
          alreadyPurchased: true,

          message:
            "Ka riga ka sayi wannan film. Ka shiga My Movies.",
        });
      }

      // =================================
      // CREATE REFERENCE
      // =================================

      const reference =
        `WEB_${user.id}_${film.id}_${Date.now()}_${crypto
          .randomBytes(4)
          .toString("hex")}`;

      // =================================
      // CREATE WEB ORDER
      // =================================

      const order =
        await prisma.webOrder.create({
          data: {
            webUserId:
              user.id,

            filmId:
              film.id,

            amount:
              Number(film.price),

            status:
              "pending",

            paymentReference:
              reference,
          },
        });


       const returnTo =
  req.body?.returnTo === "app"
    ? "app"
    : "web";


      // =================================
      // INITIALIZE PAYSTACK
      // =================================

      const paystackResponse =
        await fetch(
          "https://api.paystack.co/transaction/initialize",
          {
            method: "POST",

            headers: {
              Authorization:
                `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,

              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              email:
                `webuser${user.id}@nigfilm.app`,

              // Kobo
              amount:
                Number(
                  film.price
                ) * 100,

              reference,
            callback_url:
  `${PUBLIC_BASE_URL}/web-payment-success?returnTo=${returnTo}`,

              metadata: {
                type:
                  "web_film_purchase",

                webUserId:
                  user.id,

                filmId:
                  film.id,

                webOrderId:
                  order.id,
              },
            }),
          }
        );

      const paystackData =
        await paystackResponse.json();

      if (
        !paystackResponse.ok ||
        !paystackData?.status ||
        !paystackData?.data
          ?.authorization_url
      ) {
        console.error(
          "âŒ WEB PAYSTACK INITIALIZE ERROR:",
          paystackData
        );

        await prisma.webOrder.update({
          where: {
            id: order.id,
          },

          data: {
            status: "failed",
          },
        });

        return res.status(502).json({
          success: false,
          message:
            paystackData?.message ||
            "An kasa fara Paystack payment.",
        });
      }

      console.log(
        "âœ… WEB PAYSTACK INITIALIZED:",
        reference
      );

      return res.status(200).json({
        success: true,

        authorizationUrl:
          paystackData.data
            .authorization_url,

        accessCode:
          paystackData.data
            .access_code,

        reference,

        order: {
          id: order.id,
          amount:
            order.amount,
          status:
            order.status,
        },
      });
    } catch (error) {
      console.error(
        "âŒ WEB PAYMENT INITIALIZE ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "An samu matsala wajen fara payment.",
      });
    }
  }
);
// ======================================================
// WEB PAYMENT CALLBACK
// ======================================================

app.get(
  "/web-payment-success",
  async (req, res) => {
    // =========================================
    // DETERMINE WHERE USER SHOULD RETURN
    // =========================================

    const returnTo =
      String(
        req.query.returnTo || "web"
      ).toLowerCase() === "app"
        ? "app"
        : "web";

    const returnUrl =
      returnTo === "app"
        ? "com.nigfilm.app://payment-success"
        : WEB_APP_URL;

    try {
      // =========================================
      // GET PAYMENT REFERENCE
      // =========================================

      const reference =
        String(
          req.query.reference || ""
        ).trim();

      if (!reference) {
        return res
          .status(400)
          .send(
            buildWebPaymentPage({
              success: false,

              title:
                "Payment Reference Missing",

              message:
                "Ba a samu payment reference ba.",

              returnUrl,
            })
          );
      }

      // =========================================
      // VERIFY PAYMENT WITH PAYSTACK
      // =========================================

      const verification =
        await verifyPaystackTransaction(
          reference
        );

      if (!verification.success) {
        return res
          .status(400)
          .send(
            buildWebPaymentPage({
              success: false,

              title:
                "Payment Not Confirmed",

              message:
                verification.message,

              returnUrl,
            })
          );
      }

      // =========================================
      // PROCESS FILM PURCHASE
      // =========================================

      const result =
        await processWebFilmPayment({
          reference,

          paidAmount:
            verification.amount,
        });

      if (!result.success) {
        return res
          .status(400)
          .send(
            buildWebPaymentPage({
              success: false,

              title:
                "Payment Problem",

              message:
                result.message,

              returnUrl,
            })
          );
      }

      // =========================================
      // SUCCESS
      // =========================================

      return res
        .status(200)
        .send(
          buildWebPaymentPage({
            success: true,

            title:
              "Payment Successful",

            message:
              "An tabbatar da payment ɗinka. Film ɗin ya shiga My Movies.",

            returnUrl,
          })
        );
    } catch (error) {
      console.error(
        "❌ WEB PAYMENT CALLBACK ERROR:",
        error
      );

      return res
        .status(500)
        .send(
          buildWebPaymentPage({
            success: false,

            title:
              "Payment Error",

            message:
              "An samu matsala wajen tabbatar da payment.",

            returnUrl,
          })
        );
    }
  }
);
// ======================================================
// PREMIUM PAYMENT CALLBACK
// ======================================================

app.get(
  "/premium-payment-success",
  async (req, res) => {
    const returnTo =
      String(
        req.query.returnTo || "web"
      ).toLowerCase() === "app"
        ? "app"
        : "web";

    const returnUrl =
      returnTo === "app"
        ? "com.nigfilm.app://payment-success"
        : WEB_APP_URL;

    try {
      const reference =
        String(
          req.query.reference || ""
        ).trim();

      if (!reference) {
        return res
          .status(400)
          .send(
            buildWebPaymentPage({
              success: false,

              title:
                "Premium Payment Reference Missing",

              message:
                "Ba a samu Premium payment reference ba.",

              returnUrl,
            })
          );
      }

      const verification =
        await verifyPaystackTransaction(
          reference
        );

      if (!verification.success) {
        return res
          .status(400)
          .send(
            buildWebPaymentPage({
              success: false,

              title:
                "Premium Payment Not Confirmed",

              message:
                verification.message,

              returnUrl,
            })
          );
      }

      const result =
        await processPremiumPayment({
          reference,

          paidAmount:
            verification.amount,
        });

      if (!result.success) {
        return res
          .status(400)
          .send(
            buildWebPaymentPage({
              success: false,

              title:
                "Premium Activation Problem",

              message:
                result.message,

              returnUrl,
            })
          );
      }

      return res
        .status(200)
        .send(
          buildWebPaymentPage({
            success: true,

            title:
              "Premium Activated",

            message:
              "An tabbatar da payment ɗinka. NIGFILM Premium ya kunna cikin nasara.",

            returnUrl,
          })
        );
    } catch (error) {
      console.error(
        "❌ PREMIUM PAYMENT CALLBACK ERROR:",
        error
      );

      return res
        .status(500)
        .send(
          buildWebPaymentPage({
            success: false,

            title:
              "Premium Payment Error",

            message:
              "An samu matsala wajen kunna Premium.",

            returnUrl,
          })
        );
    }
  }
);
}