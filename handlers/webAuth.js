import crypto from "crypto";
import { prisma } from "../bot.js";

export default function registerWebAuthHandlers(
  app,
  { requireWebUser }
) {
  // ======================================================
  // WEB AUTH HELPERS
  // ======================================================

  function normalizePhone(value) {
    return String(value || "")
      .trim()
      .replace(/\s+/g, "")
      .replace(/-/g, "");
  }

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

  function verifyPassword(password, passwordHash) {
    try {
      const [salt, savedHash] =
        String(passwordHash || "").split(":");

      if (!salt || !savedHash) {
        return false;
      }

      const generatedHash =
        crypto.scryptSync(
          String(password),
          salt,
          64
        );

      const savedHashBuffer =
        Buffer.from(savedHash, "hex");

      if (
        generatedHash.length !==
        savedHashBuffer.length
      ) {
        return false;
      }

      return crypto.timingSafeEqual(
        generatedHash,
        savedHashBuffer
      );
    } catch {
      return false;
    }
  }

  function hashSessionToken(token) {
    return crypto
      .createHash("sha256")
      .update(String(token || ""))
      .digest("hex");
  }

  async function createWebSession(webUserId) {
    const userId = Number(webUserId);

    if (
      !Number.isInteger(userId) ||
      userId <= 0
    ) {
      throw new Error(
        "Invalid Web User ID for session."
      );
    }

    const token = crypto
      .randomBytes(48)
      .toString("hex");

    const tokenHash =
      hashSessionToken(token);

    const expiresAt = new Date(
      Date.now() +
        30 * 24 * 60 * 60 * 1000
    );

    await prisma.webSession.deleteMany({
      where: {
        webUserId: userId,
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    await prisma.webSession.create({
      data: {
        webUserId: userId,
        tokenHash,
        expiresAt,
      },
    });

    return {
      token,
      expiresAt,
    };
  }

  // ======================================================
  // REGISTER
  // ======================================================

  app.post(
    "/api/auth/register",
    async (req, res) => {
      try {
        const fullName =
          String(
            req.body?.fullName || ""
          ).trim();

        const phone =
          normalizePhone(
            req.body?.phone
          );

        const password =
          String(
            req.body?.password || ""
          );

        if (
          !fullName ||
          !phone ||
          !password
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Ka cika duk bayanan da ake buƙata.",
          });
        }

        if (fullName.length < 2) {
          return res.status(400).json({
            success: false,
            message:
              "Ka saka cikakken suna.",
          });
        }

        if (phone.length < 10) {
          return res.status(400).json({
            success: false,
            message:
              "Phone number bai dace ba.",
          });
        }

        if (password.length < 6) {
          return res.status(400).json({
            success: false,
            message:
              "Password ya zama aƙalla haruffa 6.",
          });
        }

        const existingUser =
          await prisma.webUser.findUnique({
            where: {
              phone,
            },
          });

        if (existingUser) {
          return res.status(409).json({
            success: false,
            message:
              "An riga an yi register da wannan phone number.",
          });
        }

        const passwordHash =
          hashPassword(password);

        const user =
          await prisma.webUser.create({
            data: {
              fullName,
              phone,
              passwordHash,
            },

            select: {
              id: true,
              fullName: true,
              phone: true,
              role: true,
              createdAt: true,
            },
          });

        const session =
          await createWebSession(
            user.id
          );

        console.log(
          "✅ WEB USER REGISTERED:",
          user.id
        );

        return res.status(201).json({
          success: true,

          message:
            "Account an ƙirƙira cikin nasara.",

          user,

          session: {
            token:
              session.token,

            expiresAt:
              session.expiresAt,
          },
        });
      } catch (error) {
        console.error(
          "❌ WEB REGISTER ERROR:",
          error
        );

        return res.status(500).json({
          success: false,
          message:
            "An samu matsala wajen ƙirƙirar account.",
        });
      }
    }
  );

  // ======================================================
  // LOGIN
  // ======================================================

  app.post(
    "/api/auth/login",
    async (req, res) => {
      try {
        const phone =
          normalizePhone(
            req.body?.phone
          );

        const password =
          String(
            req.body?.password || ""
          );

        if (!phone || !password) {
          return res.status(400).json({
            success: false,
            message:
              "Ka saka phone number da password.",
          });
        }

        const user =
          await prisma.webUser.findUnique({
            where: {
              phone,
            },
          });

        if (!user) {
          return res.status(401).json({
            success: false,
            message:
              "Phone number ko password bai dace ba.",
          });
        }

        const passwordCorrect =
          verifyPassword(
            password,
            user.passwordHash
          );

        if (!passwordCorrect) {
          return res.status(401).json({
            success: false,
            message:
              "Phone number ko password bai dace ba.",
          });
        }

        const session =
          await createWebSession(
            user.id
          );

        console.log(
          "✅ WEB USER LOGIN:",
          user.id,
          user.role
        );

        return res.status(200).json({
          success: true,

          message:
            "Login ya yi nasara.",

          user: {
            id: user.id,
            fullName: user.fullName,
            phone: user.phone,
            role: user.role,
            mustChangePassword:
              user.mustChangePassword,
          },

          session: {
            token:
              session.token,

            expiresAt:
              session.expiresAt,
          },
        });
      } catch (error) {
        console.error(
          "❌ WEB LOGIN ERROR:",
          error
        );

        return res.status(500).json({
          success: false,
          message:
            "An samu matsala wajen login.",
        });
      }
    }
  );

  // ======================================================
  // FORGOT PASSWORD - REQUEST RESET
  // ======================================================

  app.post(
    "/api/auth/forgot-password/request",
    async (req, res) => {
      try {
        const phone =
          normalizePhone(
            req.body?.phone
          );

        if (!phone) {
          return res.status(400).json({
            success: false,
            message:
              "Ka saka phone number.",
          });
        }

        const genericResponse = {
          success: true,
          message:
            "An karɓi request ɗinka. Idan wannan phone number yana da account, admin zai duba request ɗin.",
        };

        const user =
          await prisma.webUser.findUnique({
            where: {
              phone,
            },
          });

        // Kar mu bayyana ko account yana nan ko babu
        if (!user) {
          return res
            .status(200)
            .json(genericResponse);
        }

        // Rufe tsoffin requests da ba a yi amfani da su ba
        await prisma.passwordReset.updateMany({
          where: {
            webUserId: user.id,
            usedAt: null,
          },

          data: {
            usedAt: new Date(),
          },
        });

        const requestToken =
          crypto
            .randomBytes(32)
            .toString("hex");

        const requestTokenHash =
          crypto
            .createHash("sha256")
            .update(requestToken)
            .digest("hex");

        const expiresAt =
          new Date(
            Date.now() +
              24 * 60 * 60 * 1000
          );

        await prisma.passwordReset.create({
          data: {
            webUserId: user.id,
            requestTokenHash,
            expiresAt,
          },
        });

        console.log(
          "PASSWORD RESET REQUEST:",
          user.id
        );

        return res
          .status(200)
          .json(genericResponse);
      } catch (error) {
        console.error(
          "PASSWORD RESET REQUEST ERROR:",
          error
        );

        return res.status(500).json({
          success: false,
          message:
            "An samu matsala wajen aika reset request.",
        });
      }
    }
  );

  // ======================================================
  // USER - COMPLETE PASSWORD RESET
  // ======================================================

  app.post(
    "/api/auth/forgot-password/reset",
    async (req, res) => {
      try {
        const phone =
          normalizePhone(
            req.body?.phone
          );

        const code =
          String(
            req.body?.code || ""
          ).trim();

        const newPassword =
          String(
            req.body?.newPassword || ""
          );

        const confirmPassword =
          String(
            req.body?.confirmPassword || ""
          );

        if (
          !phone ||
          !code ||
          !newPassword ||
          !confirmPassword
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Ka cika dukkan bayanan da ake bukata.",
          });
        }

        if (!/^\d{6}$/.test(code)) {
          return res.status(400).json({
            success: false,
            message:
              "Reset code ya zama lambobi 6.",
          });
        }

        if (newPassword.length < 6) {
          return res.status(400).json({
            success: false,
            message:
              "Sabon password ya zama akalla haruffa 6.",
          });
        }

        if (
          newPassword !==
          confirmPassword
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Passwords din ba su yi daidai ba.",
          });
        }

        const user =
          await prisma.webUser.findUnique({
            where: {
              phone,
            },
          });

        if (!user) {
          return res.status(400).json({
            success: false,
            message:
              "Reset code ko phone number bai dace ba.",
          });
        }

        const codeHash =
          crypto
            .createHash("sha256")
            .update(code)
            .digest("hex");

        const resetRequest =
          await prisma.passwordReset.findFirst({
            where: {
              webUserId: user.id,
              codeHash,
              usedAt: null,

              expiresAt: {
                gt: new Date(),
              },
            },

            orderBy: {
              createdAt: "desc",
            },
          });

        if (!resetRequest) {
          return res.status(400).json({
            success: false,
            message:
              "Reset code bai dace ba ko ya kare.",
          });
        }

        const passwordHash =
          hashPassword(newPassword);

        await prisma.$transaction([
          prisma.webUser.update({
            where: {
              id: user.id,
            },

            data: {
              passwordHash,
              mustChangePassword: false,
            },
          }),

          prisma.passwordReset.update({
            where: {
              id: resetRequest.id,
            },

            data: {
              usedAt: new Date(),
            },
          }),

          // Fitar da account daga duk tsoffin sessions
          prisma.webSession.deleteMany({
            where: {
              webUserId: user.id,
            },
          }),
        ]);

        return res.status(200).json({
          success: true,
          message:
            "Password ya canza cikin nasara. Ka shiga da sabon password.",
        });
      } catch (error) {
        console.error(
          "COMPLETE PASSWORD RESET ERROR:",
          error
        );

        return res.status(500).json({
          success: false,
          message:
            "An samu matsala wajen canza password.",
        });
      }
    }
  );

  // ======================================================
  // USER - CHANGE PASSWORD
  // ======================================================

  app.post(
    "/api/auth/change-password",
    requireWebUser,
    async (req, res) => {
      try {
        const userId =
          req.webUser.id;

        const currentPassword =
          String(
            req.body?.currentPassword || ""
          );

        const newPassword =
          String(
            req.body?.newPassword || ""
          );

        const confirmPassword =
          String(
            req.body?.confirmPassword || ""
          );

        if (
          !currentPassword ||
          !newPassword ||
          !confirmPassword
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Ka cika dukkan bayanan password.",
          });
        }

        if (newPassword.length < 6) {
          return res.status(400).json({
            success: false,
            message:
              "Sabon password ya zama akalla haruffa 6.",
          });
        }

        if (
          newPassword !==
          confirmPassword
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Sabbin passwords ba su yi daidai ba.",
          });
        }

        const user =
          await prisma.webUser.findUnique({
            where: {
              id: userId,
            },
          });

        if (!user) {
          return res.status(404).json({
            success: false,
            message:
              "Ba a samu account din ba.",
          });
        }

        const currentPasswordCorrect =
          verifyPassword(
            currentPassword,
            user.passwordHash
          );

        if (!currentPasswordCorrect) {
          return res.status(400).json({
            success: false,
            message:
              "Current password bai dace ba.",
          });
        }

        const passwordHash =
          hashPassword(newPassword);

        await prisma.$transaction([
          prisma.webUser.update({
            where: {
              id: userId,
            },

            data: {
              passwordHash,
              mustChangePassword: false,
            },
          }),

          // Bayan canza password,
          // fitar da account daga duk devices.
          prisma.webSession.deleteMany({
            where: {
              webUserId: userId,
            },
          }),
        ]);

        return res.status(200).json({
          success: true,
          message:
            "Password ya canza cikin nasara. Ka sake login da sabon password.",
        });
      } catch (error) {
        console.error(
          "CHANGE PASSWORD ERROR:",
          error
        );

        return res.status(500).json({
          success: false,
          message:
            "An samu matsala wajen canza password.",
        });
      }
    }
  );
}