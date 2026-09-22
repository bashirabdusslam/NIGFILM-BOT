import crypto from "crypto";
import { prisma } from "../bot.js";

export default function registerAdminPasswordResetHandlers(
  app,
  { requireAdmin }
) {
  // ======================================================
  // PASSWORD HELPER
  // ======================================================

  function hashPassword(password) {
    const salt = crypto
      .randomBytes(16)
      .toString("hex");

    const hash = crypto
      .scryptSync(
        String(password),
        salt,
        64
      )
      .toString("hex");

    return `${salt}:${hash}`;
  }

  // ======================================================
  // ADMIN - LIST PASSWORD RESET REQUESTS
  // ======================================================

  app.get(
    "/api/admin/password-reset-requests",
    requireAdmin,
    async (req, res) => {
      try {
        const requests =
          await prisma.passwordReset.findMany({
            where: {
              usedAt: null,
              codeHash: null,

              expiresAt: {
                gt: new Date(),
              },
            },

            orderBy: {
              createdAt: "desc",
            },

            include: {
              user: {
                select: {
                  id: true,
                  fullName: true,
                  phone: true,
                  createdAt: true,
                },
              },
            },
          });

        return res.status(200).json({
          success: true,
          count: requests.length,

          requests: requests.map(
            (request) => ({
              id: request.id,
              createdAt:
                request.createdAt,
              expiresAt:
                request.expiresAt,
              user: request.user,
            })
          ),
        });
      } catch (error) {
        console.error(
          "ADMIN PASSWORD RESET LIST ERROR:",
          error
        );

        return res.status(500).json({
          success: false,
          message:
            "An samu matsala wajen dauko password reset requests.",
        });
      }
    }
  );

  // ======================================================
  // ADMIN - APPROVE PASSWORD RESET + GENERATE CODE
  // ======================================================

  app.post(
    "/api/admin/password-reset-requests/:requestId/approve",
    requireAdmin,
    async (req, res) => {
      try {
        const requestId =
          Number(
            req.params.requestId
          );

        if (
          !Number.isInteger(
            requestId
          ) ||
          requestId <= 0
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Reset request ID bai dace ba.",
          });
        }

        const resetRequest =
          await prisma.passwordReset.findUnique({
            where: {
              id: requestId,
            },

            include: {
              user: {
                select: {
                  id: true,
                  fullName: true,
                  phone: true,
                },
              },
            },
          });

        if (!resetRequest) {
          return res.status(404).json({
            success: false,
            message:
              "Ba a samu reset request din ba.",
          });
        }

        if (resetRequest.usedAt) {
          return res.status(400).json({
            success: false,
            message:
              "An riga an gama amfani da wannan request.",
          });
        }

        if (
          resetRequest.expiresAt <
          new Date()
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Wannan reset request ya kare.",
          });
        }

        const code =
          String(
            crypto.randomInt(
              100000,
              1000000
            )
          );

        const codeHash =
          crypto
            .createHash("sha256")
            .update(code)
            .digest("hex");

        // Bayan admin approval,
        // code zai yi aiki na minti 30 kacal.
        const expiresAt =
          new Date(
            Date.now() +
              30 * 60 * 1000
          );

        await prisma.passwordReset.update({
          where: {
            id: requestId,
          },

          data: {
            codeHash,
            expiresAt,
          },
        });

        return res.status(200).json({
          success: true,

          message:
            "Reset code ya samu nasara.",

          resetCode: code,

          expiresAt,

          user: resetRequest.user,
        });
      } catch (error) {
        console.error(
          "ADMIN APPROVE PASSWORD RESET ERROR:",
          error
        );

        return res.status(500).json({
          success: false,
          message:
            "An samu matsala wajen samar da reset code.",
        });
      }
    }
  );

  // ======================================================
  // ADMIN - DIRECT RESET USER PASSWORD
  // ======================================================

  app.post(
    "/api/admin/users/:userId/reset-password",
    requireAdmin,
    async (req, res) => {
      try {
        const userId =
          Number(
            req.params.userId
          );

        const temporaryPassword =
          String(
            req.body
              ?.temporaryPassword ||
              ""
          );

        if (
          !Number.isInteger(
            userId
          ) ||
          userId <= 0
        ) {
          return res.status(400).json({
            success: false,
            message:
              "User ID bai dace ba.",
          });
        }

        if (
          temporaryPassword.length <
          6
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Temporary password ya zama akalla haruffa 6.",
          });
        }

        const user =
          await prisma.webUser.findUnique({
            where: {
              id: userId,
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
              "Ba a samu user din ba.",
          });
        }

        const passwordHash =
          hashPassword(
            temporaryPassword
          );

        await prisma.$transaction([
          prisma.webUser.update({
            where: {
              id: user.id,
            },

            data: {
              passwordHash,
              mustChangePassword:
                true,
            },
          }),

          // Kashe duk tsoffin login sessions
          prisma.webSession.deleteMany({
            where: {
              webUserId:
                user.id,
            },
          }),

          // Rufe duk pending reset requests
          prisma.passwordReset.updateMany({
            where: {
              webUserId:
                user.id,
              usedAt: null,
            },

            data: {
              usedAt:
                new Date(),
            },
          }),
        ]);

        return res.status(200).json({
          success: true,

          message:
            "Password din user ya samu reset. Dole user ya canza temporary password bayan login.",

          user,
        });
      } catch (error) {
        console.error(
          "ADMIN DIRECT PASSWORD RESET ERROR:",
          error
        );

        return res.status(500).json({
          success: false,
          message:
            "An samu matsala wajen reset password.",
        });
      }
    }
  );
}