import crypto from "crypto";
import { prisma } from "../bot.js";
import {
  hasActivePremium,
} from "./premium.js";

// ======================================================
// WATCH 5 ADS - CONFIG
// ======================================================

export const AD_UNLOCK_REQUIRED_ADS = 5;

export const AD_UNLOCK_DURATION_MS =
  24 * 60 * 60 * 1000;

export const AD_ATTEMPT_DURATION_MS =
  10 * 60 * 1000;

// ======================================================
// HASH AD ATTEMPT TOKEN
// ======================================================

function hashAdAttemptToken(token) {
  return crypto
    .createHash("sha256")
    .update(String(token || ""))
    .digest("hex");
}

// ======================================================
// CHECK ACTIVE AD MOVIE UNLOCK
// ======================================================

export async function getActiveAdMovieUnlock(
  webUserId,
  filmId
) {
  const userId = Number(webUserId);
  const movieId = Number(filmId);

  if (
    !Number.isInteger(userId) ||
    userId <= 0 ||
    !Number.isInteger(movieId) ||
    movieId <= 0
  ) {
    return null;
  }

  const now = new Date();

  const unlock =
    await prisma.adMovieUnlock.findUnique({
      where: {
        webUserId_filmId: {
          webUserId: userId,
          filmId: movieId,
        },
      },
    });

  if (!unlock) {
    return null;
  }

  if (
    unlock.status === "UNLOCKED" &&
    unlock.expiresAt &&
    unlock.expiresAt > now
  ) {
    return unlock;
  }

  if (
    unlock.status === "UNLOCKED" &&
    (!unlock.expiresAt ||
      unlock.expiresAt <= now)
  ) {
    await prisma.adMovieUnlock.update({
      where: {
        id: unlock.id,
      },

      data: {
        status: "EXPIRED",
      },
    });

    return null;
  }

  return null;
}

// ======================================================
// HAS ACTIVE AD MOVIE UNLOCK
// ======================================================

export async function hasActiveAdMovieUnlock(
  webUserId,
  filmId
) {
  const unlock =
    await getActiveAdMovieUnlock(
      webUserId,
      filmId
    );

  return Boolean(unlock);
}

// ======================================================
// REGISTER AD UNLOCK HANDLERS
// ======================================================

export default function registerAdUnlockHandlers(
  app,
  {
    requireWebUser,
  }
) {
  // ====================================================
  // WATCH 5 ADS - GET UNLOCK STATUS
  // ====================================================

  app.get(
    "/api/web/ads/unlock-status/:filmId",
    requireWebUser,
    async (req, res) => {
      try {
        const webUserId =
          req.webUser.id;

        const filmId =
          Number(
            req.params.filmId
          );

        if (
          !Number.isInteger(filmId) ||
          filmId <= 0
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Film ID bai dace ba.",
          });
        }

        const film =
          await prisma.film.findUnique({
            where: {
              id: filmId,
            },

            select: {
              id: true,
            },
          });

        if (!film) {
          return res.status(404).json({
            success: false,
            message:
              "Ba a samu wannan film ba.",
          });
        }

        let unlock =
          await prisma.adMovieUnlock.findUnique({
            where: {
              webUserId_filmId: {
                webUserId,
                filmId,
              },
            },
          });

        const now = new Date();

        if (
          unlock?.status ===
            "UNLOCKED" &&
          unlock.expiresAt &&
          unlock.expiresAt <= now
        ) {
          unlock =
            await prisma.adMovieUnlock.update({
              where: {
                id: unlock.id,
              },

              data: {
                status: "EXPIRED",
                watchedAds: 0,
                unlockedAt: null,
                expiresAt: null,
              },
            });
        }

        const active =
          unlock?.status ===
            "UNLOCKED" &&
          unlock?.expiresAt &&
          unlock.expiresAt > now;

        return res.status(200).json({
          success: true,

          filmId,

          watchedAds:
            active
              ? AD_UNLOCK_REQUIRED_ADS
              : Math.min(
                  unlock?.watchedAds || 0,
                  AD_UNLOCK_REQUIRED_ADS
                ),

          requiredAds:
            AD_UNLOCK_REQUIRED_ADS,

          unlocked:
            Boolean(active),

          expiresAt:
            active
              ? unlock.expiresAt
              : null,
        });
      } catch (error) {
        console.error(
          "❌ AD UNLOCK STATUS ERROR:",
          error
        );

        return res.status(500).json({
          success: false,
          message:
            "An samu matsala wajen duba Ad Unlock.",
        });
      }
    }
  );

  // ====================================================
  // WATCH 5 ADS - START ATTEMPT
  // ====================================================

  app.post(
    "/api/web/ads/start-attempt",
    requireWebUser,
    async (req, res) => {
      try {
        const webUserId =
          req.webUser.id;

        const filmId =
          Number(
            req.body?.filmId
          );

        if (
          !Number.isInteger(filmId) ||
          filmId <= 0
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Film ID bai dace ba.",
          });
        }

        const film =
          await prisma.film.findUnique({
            where: {
              id: filmId,
            },

            select: {
              id: true,
            },
          });

        if (!film) {
          return res.status(404).json({
            success: false,
            message:
              "Ba a samu wannan film ba.",
          });
        }

        const purchase =
          await prisma.webPurchase.findUnique({
            where: {
              webUserId_filmId: {
                webUserId,
                filmId,
              },
            },

            select: {
              id: true,
            },
          });

        const premium =
          await hasActivePremium(
            webUserId
          );

        if (purchase || premium) {
          return res.status(200).json({
            success: true,
            alreadyHasAccess: true,
            message:
              "Kana da damar kallon wannan film tuni.",
          });
        }

        const existingUnlock =
          await getActiveAdMovieUnlock(
            webUserId,
            filmId
          );

        if (existingUnlock) {
          return res.status(200).json({
            success: true,
            alreadyUnlocked: true,

            watchedAds:
              AD_UNLOCK_REQUIRED_ADS,

            requiredAds:
              AD_UNLOCK_REQUIRED_ADS,

            expiresAt:
              existingUnlock.expiresAt,
          });
        }

        // Expire old pending attempts.
        await prisma.adRewardAttempt.updateMany({
          where: {
            webUserId,
            filmId,
            status: "PENDING",

            expiresAt: {
              lte: new Date(),
            },
          },

          data: {
            status: "EXPIRED",
          },
        });

        // Prevent two active attempts at once.
        const existingPending =
          await prisma.adRewardAttempt.findFirst({
            where: {
              webUserId,
              filmId,
              status: "PENDING",

              expiresAt: {
                gt: new Date(),
              },
            },

            orderBy: {
              createdAt: "desc",
            },
          });

        if (existingPending) {
          return res.status(409).json({
            success: false,
            message:
              "Akwai Ad attempt da bai gama ba tukuna.",
          });
        }

        const rawToken =
          crypto
            .randomBytes(32)
            .toString("hex");

        const attemptTokenHash =
          hashAdAttemptToken(
            rawToken
          );

        const expiresAt =
          new Date(
            Date.now() +
              AD_ATTEMPT_DURATION_MS
          );

        await prisma.adRewardAttempt.create({
          data: {
            webUserId,
            filmId,
            attemptTokenHash,
            status: "PENDING",
            expiresAt,
          },
        });

        return res.status(201).json({
          success: true,
          attemptToken: rawToken,
          expiresAt,
        });
      } catch (error) {
        console.error(
          "❌ START AD ATTEMPT ERROR:",
          error
        );

        return res.status(500).json({
          success: false,
          message:
            "An samu matsala wajen fara Ad.",
        });
      }
    }
  );

  // ====================================================
  // WATCH 5 ADS - COMPLETE ATTEMPT
  // ====================================================

  app.post(
    "/api/web/ads/complete-attempt",
    requireWebUser,
    async (req, res) => {
      try {
        const webUserId =
          req.webUser.id;

        const filmId =
          Number(
            req.body?.filmId
          );

        const attemptToken =
          String(
            req.body?.attemptToken || ""
          ).trim();

        if (
          !Number.isInteger(filmId) ||
          filmId <= 0 ||
          !attemptToken
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Ad completion request bai cika ba.",
          });
        }

        const attemptTokenHash =
          hashAdAttemptToken(
            attemptToken
          );

        const attempt =
          await prisma.adRewardAttempt.findUnique({
            where: {
              attemptTokenHash,
            },
          });

        if (
          !attempt ||
          attempt.webUserId !==
            webUserId ||
          attempt.filmId !== filmId
        ) {
          return res.status(403).json({
            success: false,
            message:
              "Ad attempt bai dace ba.",
          });
        }

        if (
          attempt.status ===
          "REWARDED"
        ) {
          return res.status(409).json({
            success: false,
            message:
              "An riga an kirga wannan Ad.",
          });
        }

        if (
          attempt.status !==
          "PENDING"
        ) {
          return res.status(409).json({
            success: false,
            message:
              "Wannan Ad attempt baya aiki.",
          });
        }

        if (
          attempt.expiresAt <=
          new Date()
        ) {
          await prisma.adRewardAttempt.update({
            where: {
              id: attempt.id,
            },

            data: {
              status: "EXPIRED",
            },
          });

          return res.status(410).json({
            success: false,
            message:
              "Lokacin wannan Ad attempt ya kare.",
          });
        }

        const result =
          await prisma.$transaction(
            async (tx) => {
              const freshAttempt =
                await tx.adRewardAttempt.findUnique({
                  where: {
                    id: attempt.id,
                  },
                });

              if (
                !freshAttempt ||
                freshAttempt.status !==
                  "PENDING" ||
                freshAttempt.expiresAt <=
                  new Date()
              ) {
                return {
                  counted: false,
                };
              }

              await tx.adRewardAttempt.update({
                where: {
                  id:
                    freshAttempt.id,
                },

                data: {
                  status:
                    "REWARDED",

                  rewardedAt:
                    new Date(),
                },
              });

              let unlock =
                await tx.adMovieUnlock.upsert({
                  where: {
                    webUserId_filmId: {
                      webUserId,
                      filmId,
                    },
                  },

                  create: {
                    webUserId,
                    filmId,
                    watchedAds: 1,

                    requiredAds:
                      AD_UNLOCK_REQUIRED_ADS,

                    status:
                      "IN_PROGRESS",
                  },

                  update: {
                    watchedAds: {
                      increment: 1,
                    },

                    requiredAds:
                      AD_UNLOCK_REQUIRED_ADS,

                    status:
                      "IN_PROGRESS",

                    unlockedAt:
                      null,

                    expiresAt:
                      null,
                  },
                });

              const watchedAds =
                Math.min(
                  unlock.watchedAds,
                  AD_UNLOCK_REQUIRED_ADS
                );

              if (
                watchedAds >=
                AD_UNLOCK_REQUIRED_ADS
              ) {
                const unlockedAt =
                  new Date();

                const expiresAt =
                  new Date(
                    unlockedAt.getTime() +
                      AD_UNLOCK_DURATION_MS
                  );

                unlock =
                  await tx.adMovieUnlock.update({
                    where: {
                      id:
                        unlock.id,
                    },

                    data: {
                      watchedAds:
                        AD_UNLOCK_REQUIRED_ADS,

                      status:
                        "UNLOCKED",

                      unlockedAt,

                      expiresAt,
                    },
                  });
              }

              return {
                counted: true,
                unlock,
              };
            }
          );

        if (!result.counted) {
          return res.status(409).json({
            success: false,
            message:
              "Ba a kirga wannan Ad ba.",
          });
        }

        const unlocked =
          result.unlock.status ===
          "UNLOCKED";

        return res.status(200).json({
          success: true,

          counted: true,

          watchedAds:
            Math.min(
              result.unlock.watchedAds,
              AD_UNLOCK_REQUIRED_ADS
            ),

          requiredAds:
            AD_UNLOCK_REQUIRED_ADS,

          unlocked,

          expiresAt:
            unlocked
              ? result.unlock.expiresAt
              : null,

          message:
            unlocked
              ? "An bude film na awa 24."
              : `Ka kalli ${result.unlock.watchedAds}/${AD_UNLOCK_REQUIRED_ADS} Ads.`,
        });
      } catch (error) {
        console.error(
          "❌ COMPLETE AD ATTEMPT ERROR:",
          error
        );

        return res.status(500).json({
          success: false,
          message:
            "An samu matsala wajen kirga Ad.",
        });
      }
    }
  );
}