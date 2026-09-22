import crypto from "crypto";
import { prisma } from "../bot.js";

// ======================================================
// HASH WEB SESSION TOKEN
// ======================================================

export function hashSessionToken(token) {
  return crypto
    .createHash("sha256")
    .update(String(token || ""))
    .digest("hex");
}

// ======================================================
// CREATE WEB SESSION
// ======================================================

export async function createWebSession(
  webUserId
) {
  const userId =
    Number(webUserId);

  if (
    !Number.isInteger(userId) ||
    userId <= 0
  ) {
    throw new Error(
      "Invalid Web User ID for session."
    );
  }

  const token =
    crypto
      .randomBytes(48)
      .toString("hex");

  const tokenHash =
    hashSessionToken(token);

  const expiresAt =
    new Date(
      Date.now() +
        30 *
          24 *
          60 *
          60 *
          1000
    );

  // Share expired sessions only.
  // Kada mu goge active sessions na user.
  await prisma.webSession.deleteMany({
    where: {
      webUserId:
        userId,

      expiresAt: {
        lt: new Date(),
      },
    },
  });

  await prisma.webSession.create({
    data: {
      webUserId:
        userId,

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
// REQUIRE WEB USER
// ======================================================

export async function requireWebUser(
  req,
  res,
  next
) {
  try {
    const authorization =
      String(
        req.headers.authorization ||
          ""
      );

    if (
      !authorization.startsWith(
        "Bearer "
      )
    ) {
      return res
        .status(401)
        .json({
          success: false,
          message:
            "Authentication required.",
        });
    }

    const token =
      authorization
        .slice(7)
        .trim();

    if (!token) {
      return res
        .status(401)
        .json({
          success: false,
          message:
            "Session token bai samu ba.",
        });
    }

    const tokenHash =
      hashSessionToken(token);

    const session =
      await prisma.webSession
        .findUnique({
          where: {
            tokenHash,
          },

          include: {
            user: true,
          },
        });

    if (!session) {
      return res
        .status(401)
        .json({
          success: false,
          message:
            "Session bai dace ba.",
        });
    }

    if (
      session.expiresAt <
      new Date()
    ) {
      await prisma.webSession
        .delete({
          where: {
            id: session.id,
          },
        })
        .catch(() => {});

      return res
        .status(401)
        .json({
          success: false,
          message:
            "Session ya kare.",
        });
    }

    req.webUser =
      session.user;

    req.webSession =
      session;

    return next();
  } catch (error) {
    console.error(
      "❌ REQUIRE WEB USER ERROR:",
      error
    );

    return res
      .status(500)
      .json({
        success: false,
        message:
          "An samu matsala wajen tabbatar da account.",
      });
  }
}

// ======================================================
// REQUIRE ADMIN
// ======================================================

export async function requireAdmin(
  req,
  res,
  next
) {
  try {
    const authorization =
      String(
        req.headers.authorization ||
          ""
      );

    if (
      !authorization.startsWith(
        "Bearer "
      )
    ) {
      return res
        .status(401)
        .json({
          success: false,
          message:
            "Authentication required.",
        });
    }

    const token =
      authorization
        .slice(7)
        .trim();

    if (!token) {
      return res
        .status(401)
        .json({
          success: false,
          message:
            "Session token bai samu ba.",
        });
    }

    const tokenHash =
      hashSessionToken(token);

    const session =
      await prisma.webSession
        .findUnique({
          where: {
            tokenHash,
          },

          include: {
            user: true,
          },
        });

    if (!session) {
      return res
        .status(401)
        .json({
          success: false,
          message:
            "Session bai dace ba.",
        });
    }

    if (
      session.expiresAt <
      new Date()
    ) {
      await prisma.webSession
        .delete({
          where: {
            id: session.id,
          },
        })
        .catch(() => {});

      return res
        .status(401)
        .json({
          success: false,
          message:
            "Session ya kare.",
        });
    }

    if (
      session.user.role !==
      "ADMIN"
    ) {
      return res
        .status(403)
        .json({
          success: false,
          message:
            "Admin access required.",
        });
    }

    req.webUser =
      session.user;

    req.webSession =
      session;

    return next();
  } catch (error) {
    console.error(
      "❌ REQUIRE ADMIN ERROR:",
      error
    );

    return res
      .status(500)
      .json({
        success: false,
        message:
          "An samu matsala wajen tabbatar da Admin.",
      });
  }
}