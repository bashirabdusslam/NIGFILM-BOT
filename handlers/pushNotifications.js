import { prisma } from "../bot.js";

// ======================================================
// PUSH NOTIFICATIONS HANDLERS
// ======================================================

export default function registerPushNotificationHandlers(
  app,
  {
    requireWebUser,
  }
) {
  // ====================================================
  // PUSH NOTIFICATIONS - REGISTER DEVICE
  // ====================================================

  app.post(
    "/api/web/push/register",
    requireWebUser,
    async (req, res) => {
      try {
        const webUserId =
          req.webUser.id;

        const token =
          String(
            req.body?.token || ""
          ).trim();

        const platform =
          String(
            req.body?.platform ||
              "android"
          )
            .trim()
            .toLowerCase();

        if (
          !token ||
          token.length < 20
        ) {
          return res.status(400).json({
            success: false,
            message:
              "FCM token bai dace ba.",
          });
        }

        if (
          ![
            "android",
            "ios",
          ].includes(platform)
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Platform bai dace ba.",
          });
        }

        const device =
          await prisma.pushDevice.upsert({
            where: {
              token,
            },

            update: {
              webUserId,
              platform,
              enabled: true,
            },

            create: {
              webUserId,
              token,
              platform,
              enabled: true,
            },

            select: {
              id: true,
              platform: true,
              enabled: true,
              updatedAt: true,
            },
          });

        return res.status(200).json({
          success: true,

          message:
            "Push notification device registered.",

          device,
        });
      } catch (error) {
        console.error(
          "❌ PUSH DEVICE REGISTER ERROR:",
          error
        );

        return res.status(500).json({
          success: false,
          message:
            "An samu matsala wajen ajiye notification device.",
        });
      }
    }
  );
}