import crypto from "crypto";
import { prisma } from "../bot.js";

// ======================================================
// NIGFILM PREMIUM PLANS
// ======================================================

export const PREMIUM_PLANS = {
  WEEKLY: {
    name: "Weekly",
    amount: 1000,
    durationDays: 7,
  },

  MONTHLY: {
    name: "Monthly",
    amount: 2500,
    durationDays: 30,
  },

  YEARLY: {
    name: "Yearly",
    amount: 25000,
    durationDays: 365,
  },
};

// ======================================================
// PREMIUM EXPIRY CALCULATOR
// ======================================================

export function getPremiumExpiryDate(
  planKey,
  startDate = new Date()
) {
  const plan = PREMIUM_PLANS[planKey];

  if (!plan) {
    return null;
  }

  const expiresAt =
    new Date(startDate);

  expiresAt.setDate(
    expiresAt.getDate() +
      Number(plan.durationDays)
  );

  return expiresAt;
}

// ======================================================
// CHECK ACTIVE PREMIUM
// ======================================================

export async function getActivePremium(
  webUserId
) {
  const userId =
    Number(webUserId);

  if (
    !Number.isInteger(userId) ||
    userId <= 0
  ) {
    return null;
  }

  const now = new Date();

  const subscription =
    await prisma.premiumSubscription.findFirst({
      where: {
        webUserId: userId,

        status: "ACTIVE",

        expiresAt: {
          gt: now,
        },
      },

      orderBy: {
        expiresAt: "desc",
      },
    });

  return subscription || null;
}

export async function hasActivePremium(
  webUserId
) {
  const subscription =
    await getActivePremium(
      webUserId
    );

  return Boolean(subscription);
}

// ======================================================
// REGISTER PREMIUM HANDLERS
// ======================================================

export default function registerPremiumHandlers(
  app,
  {
    requireWebUser,
    PUBLIC_BASE_URL,
  }
) {
  // ====================================================
  // WEB PREMIUM - GET PREMIUM STATUS
  // ====================================================

  app.get(
    "/api/web/premium/status",
    requireWebUser,
    async (req, res) => {
      try {
        const webUserId =
          req.webUser.id;

        const subscription =
          await getActivePremium(
            webUserId
          );

        if (!subscription) {
          return res.status(200).json({
            success: true,
            premium: false,
            subscription: null,
          });
        }

        return res.status(200).json({
          success: true,

          premium: true,

          subscription: {
            id:
              subscription.id,

            plan:
              subscription.plan,

            status:
              subscription.status,

            amount:
              subscription.amount,

            startsAt:
              subscription.startsAt,

            expiresAt:
              subscription.expiresAt,
          },
        });
      } catch (error) {
        console.error(
          "❌ PREMIUM STATUS ERROR:",
          error
        );

        return res.status(500).json({
          success: false,
          message:
            "An samu matsala wajen duba Premium status.",
        });
      }
    }
  );

  // ====================================================
  // WEB PREMIUM - GET PLANS
  // ====================================================

  app.get(
    "/api/web/premium/plans",
    requireWebUser,
    async (req, res) => {
      try {
        const plans =
          Object.entries(
            PREMIUM_PLANS
          ).map(
            ([key, value]) => ({
              id: key,
              name: value.name,
              amount: value.amount,
              durationDays:
                value.durationDays,
            })
          );

        return res.status(200).json({
          success: true,
          plans,
        });
      } catch (error) {
        console.error(
          "❌ PREMIUM PLANS ERROR:",
          error
        );

        return res.status(500).json({
          success: false,
          message:
            "An samu matsala wajen dauko Premium plans.",
        });
      }
    }
  );

  // ====================================================
  // WEB PREMIUM - INITIALIZE PAYMENT
  // ====================================================

  app.post(
    "/api/web/premium/initialize",
    requireWebUser,
    async (req, res) => {
      try {
        const webUserId =
          req.webUser.id;

        const requestedPlan =
          String(
            req.body?.plan || ""
          )
            .trim()
            .toUpperCase();

        // ================================================
        // VALIDATE PLAN
        // ================================================

        const plan =
          PREMIUM_PLANS[
            requestedPlan
          ];

        if (!plan) {
          return res.status(400).json({
            success: false,
            message:
              "Premium plan bai dace ba.",
          });
        }

        // ================================================
        // CHECK PAYSTACK CONFIG
        // ================================================

        if (
          !process.env
            .PAYSTACK_SECRET_KEY
        ) {
          console.error(
            "❌ PAYSTACK_SECRET_KEY babu."
          );

          return res.status(500).json({
            success: false,
            message:
              "Paystack bai gama saitawa ba.",
          });
        }

        if (!PUBLIC_BASE_URL) {
          console.error(
            "❌ PUBLIC_BASE_URL babu."
          );

          return res.status(500).json({
            success: false,
            message:
              "Public payment callback URL bai gama saitawa ba.",
          });
        }

        // ================================================
        // CHECK USER
        // ================================================

        const user =
          await prisma.webUser.findUnique({
            where: {
              id: webUserId,
            },

            select: {
              id: true,
              fullName: true,
              phone: true,
            },
          });

        if (!user) {
          return res.status(404).json({
            success: false,
            message:
              "Ba a samu wannan user ba.",
          });
        }

        // ================================================
        // CREATE PAYMENT REFERENCE
        // ================================================

        const reference =
          `PREMIUM_${user.id}_${requestedPlan}_${Date.now()}_${crypto
            .randomBytes(4)
            .toString("hex")}`;

        // ================================================
        // CREATE PREMIUM ORDER
        // ================================================

        const order =
          await prisma.premiumOrder.create({
            data: {
              webUserId:
                user.id,

              plan:
                requestedPlan,

              amount:
                Number(
                  plan.amount
                ),

              status:
                "pending",

              paymentReference:
                reference,
            },
          });

        // ================================================
        // RETURN DESTINATION
        // ================================================

        const returnTo =
          req.body?.returnTo === "app"
            ? "app"
            : "web";

        // ================================================
        // INITIALIZE PAYSTACK
        // ================================================

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
                  `premium${user.id}@nigfilm.app`,

                // Paystack amount is in Kobo.
                amount:
                  Number(
                    plan.amount
                  ) * 100,

                reference,

                callback_url:
                  `${PUBLIC_BASE_URL}/premium-payment-success?returnTo=${returnTo}`,

                metadata: {
                  type:
                    "web_premium_subscription",

                  webUserId:
                    user.id,

                  premiumOrderId:
                    order.id,

                  plan:
                    requestedPlan,
                },
              }),
            }
          );

        const paystackData =
          await paystackResponse.json();

        // ================================================
        // PAYSTACK FAILED
        // ================================================

        if (
          !paystackResponse.ok ||
          !paystackData?.status ||
          !paystackData?.data
            ?.authorization_url
        ) {
          console.error(
            "❌ PREMIUM PAYSTACK INITIALIZE ERROR:",
            paystackData
          );

          await prisma.premiumOrder.update({
            where: {
              id: order.id,
            },

            data: {
              status:
                "failed",
            },
          });

          return res.status(502).json({
            success: false,

            message:
              paystackData?.message ||
              "An kasa fara Premium payment.",
          });
        }

        console.log(
          "✅ PREMIUM PAYMENT INITIALIZED:",
          {
            webUserId:
              user.id,

            plan:
              requestedPlan,

            reference,
          }
        );

        // ================================================
        // RESPONSE
        // ================================================

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
            id:
              order.id,

            plan:
              order.plan,

            amount:
              order.amount,

            status:
              order.status,
          },
        });
      } catch (error) {
        console.error(
          "❌ PREMIUM PAYMENT INITIALIZE ERROR:",
          error
        );

        return res.status(500).json({
          success: false,
          message:
            "An samu matsala wajen fara Premium payment.",
        });
      }
    }
  );
}