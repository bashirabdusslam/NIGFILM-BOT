import express from "express";
import crypto from "crypto";
import { Markup } from "telegraf";
import { Readable } from "node:stream";
import { bot, prisma } from "./bot.js";

import registerAdminHandlers from "./handlers/admin.js";
import registerSalesHandlers from "./handlers/sales.js";
import registerBrowseHandlers from "./handlers/browse.js";
import registerFilmHandlers from "./handlers/films.js";
import registerStartHandlers from "./handlers/start.js";
import registerMyMoviesHandlers from "./handlers/mymovies.js";
import registerUsersHandlers from "./handlers/users.js";
import registerBroadcastHandlers from "./handlers/broadcast.js";
import registerTextHandlers from "./handlers/textHandler.js";
import registerPhotoHandlers from "./handlers/photoHandler.js";
import registerVideoHandlers from "./handlers/videoHandler.js";
import registerPaymentsHandlers from "./handlers/payments.js";
import registerBunnyFilmHandler from "./handlers/bunnyFilmHandler.js";
import registerWebFilmHandlers from "./handlers/webFilms.js";
import registerWebAuthHandlers from "./handlers/webAuth.js";
import registerAdminPasswordResetHandlers from "./handlers/adminPasswordReset.js";
import registerWebPaymentHandlers from "./handlers/webPayments.js";
import registerWebMovieHandlers from "./handlers/webMovies.js";
import registerStudioHandlers from "./handlers/studios.js";
import registerAdminFilmHandlers from "./handlers/adminFilms.js";
import registerAdUnlockHandlers from "./handlers/adUnlock.js";
import registerPushNotificationHandlers from "./handlers/pushNotifications.js";
import registerPremiumHandlers from "./handlers/premium.js";
import registerBunnyUploadHandlers from "./handlers/bunnyUpload.js";
import registerTrailerHandlers from "./handlers/trailers.js";
import registerLegacyBunnyUploadHandlers from "./handlers/legacyBunnyUpload.js";
import registerTelegramWebHandlers from "./handlers/telegramWeb.js";
import registerSystemRoutes from "./handlers/systemRoutes.js";
import registerWebhookHandlers from "./handlers/webhooks.js";
import {
  securelyCompareHashes,
  processWebFilmPayment,
  processPremiumPayment,
  verifyPaystackTransaction,
  processSingleFilmPayment,
  processCartPayment,
} from "./handlers/paymentProcessors.js";
// ======================================================
// EXPRESS APP
// ======================================================

const app = express();

const PORT = process.env.PORT || 3000;

const PUBLIC_BASE_URL =
  process.env.PUBLIC_BASE_URL ||
  "http://localhost:3000";

const WEB_APP_URL =
  process.env.WEB_APP_URL ||
  "http://localhost:5173";

const TELEGRAM_WEBHOOK_URL = (
  process.env.TELEGRAM_WEBHOOK_URL ||
  `${PUBLIC_BASE_URL}/telegram-webhook`
).trim();

// ======================================================
// EXPRESS JSON + RAW BODY
// ======================================================

app.use(
  express.json({
    verify: (req, res, buffer) => {
      req.rawBody = buffer;
    },
  })
);

// ======================================================
// CORS
// ======================================================

app.use((req, res, next) => {
  res.setHeader(
    "Access-Control-Allow-Origin",
    "*"
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

// ======================================================
// ADMIN MENU
// ======================================================
const adminMenu = Markup.inlineKeyboard([
  [
    Markup.button.callback(
      "🎬 Add Film",
      "admin_add_film"
    ),
    Markup.button.callback(
      "🎞️ Manage Films",
      "admin_manage_films"
    ),
  ],
  [
    Markup.button.callback(
      "📊 Sales",
      "admin_sales"
    ),
    Markup.button.callback(
      "👥 Users",
      "admin_users"
    ),
  ],
  [
    Markup.button.callback(
      "📢 Broadcast",
      "admin_broadcast"
    ),
  ],
]);
// ======================================================
// REGISTER TELEGRAM HANDLERS
// ======================================================

registerAdminHandlers(adminMenu);
registerSalesHandlers();
registerStartHandlers();
registerBrowseHandlers();
registerFilmHandlers();
registerMyMoviesHandlers();
registerUsersHandlers();
registerBroadcastHandlers();
registerTextHandlers();
registerPhotoHandlers();
registerVideoHandlers();
registerPaymentsHandlers();
registerBunnyFilmHandler();
registerWebFilmHandlers(app);

// ======================================================
// WEB - MY MOVIES
// ======================================================

app.get(
  "/api/web/my-movies",
  async (req, res) => {
    try {
      const webUserId = Number(
        req.query.webUserId
      );

      if (
        !Number.isInteger(webUserId) ||
        webUserId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Web User ID bai dace ba.",
        });
      }

      const user =
        await prisma.webUser.findUnique({
          where: {
            id: webUserId,
          },
          select: {
            id: true,
          },
        });

      if (!user) {
        return res.status(404).json({
          success: false,
          message:
            "Ba a samu wannan user ba.",
        });
      }

      const purchases =
        await prisma.webPurchase.findMany({
          where: {
            webUserId,
          },

          orderBy: {
            createdAt: "desc",
          },

          include: {
            film: {
            select: {
  id: true,
  title: true,
  description: true,
  category: true,
  price: true,

  posterFileId: true,
  posterUrl: true,

  bunnyVideoId: true,
  webVideoUrl: true,

  featured: true,

  trailerEnabled: true,
  trailerUrl: true,
  trailerBunnyVideoId: true,

  createdAt: true,
},
            },
          },
        });

      const movies =
        purchases.map(
          (purchase) => ({
            ...purchase.film,

            posterUrl:
  purchase.film.posterUrl ||
  `/api/films/${purchase.film.id}/poster`,
          })
        );

      return res.status(200).json({
        success: true,
        count: movies.length,
        movies,
      });
    } catch (error) {
      console.error(
        "âŒ WEB MY MOVIES ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "An samu matsala wajen dauko My Movies.",
      });
    }
  }
);
// ======================================================
// WEB - DIRECT SECURE MOVIE DOWNLOAD
// ======================================================

app.get(
  "/api/web/movies/:filmId/download",
  async (req, res) => {
    try {
      const filmId = Number(
        req.params.filmId
      );

      const webUserId = Number(
        req.query.webUserId
      );

      // =================================
      // VALIDATION
      // =================================

      if (
        !Number.isInteger(filmId) ||
        filmId <= 0 ||
        !Number.isInteger(webUserId) ||
        webUserId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Film ID ko User ID bai dace ba.",
        });
      }
      // =================================
// VERIFY MOVIE ACCESS
// PURCHASE OR ACTIVE PREMIUM
// =================================

const purchase =
  await prisma.webPurchase.findFirst({
    where: {
      webUserId,
      filmId,
    },
  });

const activePremium =
  await hasActivePremium(
    webUserId
  );

if (!purchase && !activePremium) {
  return res.status(403).json({
    success: false,
    message:
      "Sai ka sayi wannan film ko ka kunna Premium.",
  });
}
      // =================================
      // GET FILM
      // =================================

      const film =
        await prisma.film.findUnique({
          where: {
            id: filmId,
          },

          select: {
            id: true,
            title: true,
            bunnyVideoId: true,
          },
        });

      if (!film) {
        return res.status(404).json({
          success: false,
          message:
            "Ba a samu wannan film ba.",
        });
      }

      if (!film.bunnyVideoId) {
        return res.status(404).json({
          success: false,
          message:
            "Wannan film bai haÉ—u da Bunny Stream ba.",
        });
      }

      // =================================
      // BUNNY CONFIG
      // =================================

      const libraryId =
        process.env.BUNNY_STREAM_LIBRARY_ID;

      const apiKey =
        process.env.BUNNY_STREAM_API_KEY;

      const tokenKey =
        process.env.BUNNY_STREAM_TOKEN_KEY;

      const cdnHostname =
        process.env.BUNNY_STREAM_CDN_HOSTNAME;

      if (
        !libraryId ||
        !apiKey ||
        !tokenKey ||
        !cdnHostname
      ) {
        return res.status(500).json({
          success: false,
          message:
            "Bunny download config bai cika ba.",
        });
      }

      // =================================
      // GET BUNNY VIDEO INFO
      // =================================

      const infoResponse =
        await fetch(
          `https://video.bunnycdn.com/library/${libraryId}/videos/${film.bunnyVideoId}`,
          {
            headers: {
              AccessKey: apiKey,
              Accept: "application/json",
            },
          }
        );

      if (!infoResponse.ok) {
        const text =
          await infoResponse.text();

        console.error(
          "âŒ BUNNY VIDEO INFO ERROR:",
          infoResponse.status,
          text
        );

        return res.status(502).json({
          success: false,
          message:
            "An kasa samun bayanin film daga Bunny.",
        });
      }

      const bunnyVideo =
        await infoResponse.json();

      // =================================
      // BEST AVAILABLE MP4
      // =================================

      const available =
        String(
          bunnyVideo.availableResolutions ||
            ""
        )
          .split(",")
          .map((item) =>
            item.trim()
          )
          .filter(Boolean);

      const preferred =
        [
          "1080p",
          "720p",
          "480p",
          "360p",
          "240p",
        ].find((resolution) =>
          available.includes(
            resolution
          )
        );

      if (!preferred) {
        return res.status(409).json({
          success: false,
          message:
            "Film bai gama processing ba tukuna.",
        });
      }

      // =================================
      // BUILD SIGNED BUNNY URL
      // =================================

      const hostname =
        cdnHostname
          .replace(/^https?:\/\//, "")
          .replace(/\/+$/, "");

      const bunnyPath =
        `/${film.bunnyVideoId}/play_${preferred}.mp4`;

      const expires =
        Math.floor(Date.now() / 1000) +
        15 * 60;

      const signaturePayload =
        `${bunnyPath}${expires}`;

      const signature =
        crypto
          .createHmac(
            "sha256",
            tokenKey
          )
          .update(signaturePayload)
          .digest("base64")
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=+$/g, "");

      const token =
        `HS256-${signature}`;

const bunnyDownloadUrl =
  `https://${hostname}${bunnyPath}` +
  `?token=${encodeURIComponent(token)}` +
  `&expires=${expires}`;
  

// =================================
// REDIRECT USER DIRECTLY TO BUNNY
// =================================

console.log(
  "⬇️ DIRECT BUNNY DOWNLOAD:",
  {
    webUserId,
    filmId,
    resolution: preferred,
  }
);

return res.redirect(
  302,
  bunnyDownloadUrl
);
     
    } catch (error) {
      console.error(
        "âŒ DIRECT DOWNLOAD ERROR:",
        error
      );

      if (!res.headersSent) {
        return res.status(500).json({
          success: false,
          message:
            "An samu matsala wajen download film.",
        });
      }
    }
  }
);

// ======================================================
// ADMIN - FEATURED ON / OFF
// ======================================================

app.patch(
  "/api/admin/films/:filmId/featured",
  requireAdmin,
  async (req, res) => {
    try {
      const filmId =
        Number(req.params.filmId);

      const featured =
        req.body?.featured;

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

      if (
        typeof featured !==
        "boolean"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Featured ya zama true ko false.",
        });
      }

      const existingFilm =
        await prisma.film.findUnique({
          where: {
            id: filmId,
          },

          select: {
            id: true,
          },
        });

      if (!existingFilm) {
        return res.status(404).json({
          success: false,
          message:
            "Ba a samu wannan film ba.",
        });
      }

      const film =
        await prisma.film.update({
          where: {
            id: filmId,
          },

          data: {
            featured,
          },

          select: {
            id: true,
            title: true,
            featured: true,
          },
        });

      return res.status(200).json({
        success: true,

        message:
          featured
            ? "An saka film a Featured."
            : "An cire film daga Featured.",

        film,
      });
    } catch (error) {
      console.error(
        "❌ ADMIN FEATURED ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "An samu matsala wajen canza Featured.",
      });
    }
  }
);
// ======================================================
// ADMIN - ADD NEW FILM
// ======================================================

app.post(
  "/api/admin/films",
  requireAdmin,
  async (req, res) => {
    try {
      const title =
        String(
          req.body?.title || ""
        ).trim();

      const description =
        String(
          req.body?.description || ""
        ).trim();

      const category =
        String(
          req.body?.category || ""
        ).trim();

      const price =
        Number(
          req.body?.price
        );

      const featured =
        req.body?.featured === true;

      // =================================
      // STUDIO / COMPANY
      // =================================

      const rawStudioId =
        req.body?.studioId;

      let studioId = null;

      if (
        rawStudioId !== undefined &&
        rawStudioId !== null &&
        rawStudioId !== ""
      ) {
        studioId =
          Number(rawStudioId);

        if (
          !Number.isInteger(studioId) ||
          studioId <= 0
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Studio ID bai dace ba.",
          });
        }

        const studio =
          await prisma.studio.findUnique({
            where: {
              id: studioId,
            },
          });

        if (!studio) {
          return res.status(404).json({
            success: false,
            message:
              "Ba a samu wannan studio/company ba.",
          });
        }

        if (!studio.active) {
          return res.status(400).json({
            success: false,
            message:
              "Wannan studio/company ba ya aiki a yanzu.",
          });
        }
      }

      // =================================
      // VALIDATION
      // =================================

      if (!title) {
        return res.status(400).json({
          success: false,
          message:
            "Ka saka sunan film.",
        });
      }

      if (!description) {
        return res.status(400).json({
          success: false,
          message:
            "Ka saka description.",
        });
      }

      if (!category) {
        return res.status(400).json({
          success: false,
          message:
            "Ka saka category.",
        });
      }

      if (
        !Number.isInteger(price) ||
        price < 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Ka saka price mai kyau.",
        });
      }

      // =================================
      // CREATE FILM
      // =================================

      const film =
        await prisma.film.create({
          data: {
            title,
            description,
            category,
            studioId,
            price,
            featured,

            posterFileId: null,
            posterUrl: null,

            bunnyVideoId: null,
            webVideoUrl: null,

            trailerEnabled: false,
            trailerUrl: null,
            trailerBunnyVideoId: null,
          },

          select: {
            id: true,
            title: true,
            description: true,
            category: true,

            studioId: true,

            studio: {
              select: {
                id: true,
                name: true,
                slug: true,
                logoUrl: true,
              },
            },

            price: true,

            posterFileId: true,
            posterUrl: true,

            bunnyVideoId: true,
            webVideoUrl: true,

            featured: true,

            trailerEnabled: true,
            trailerUrl: true,
            trailerBunnyVideoId: true,

            createdAt: true,
            updatedAt: true,
          },
        });

      console.log(
        "✅ ADMIN FILM CREATED:",
        film.id,
        film.title,
        film.studio?.name || "No studio"
      );

      return res.status(201).json({
        success: true,

        message:
          "An ƙirƙiri sabon film cikin nasara.",

        film: {
          ...film,

          posterUrl:
            film.posterUrl ||
            `/api/films/${film.id}/poster`,
        },
      });
    } catch (error) {
      console.error(
        "❌ ADMIN CREATE FILM ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "An samu matsala wajen ƙirƙirar sabon film.",
      });
    }
  }
);

// ======================================================
// REQUIRE WEB USER
// ======================================================

async function requireWebUser(
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
      return res.status(401).json({
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
      return res.status(401).json({
        success: false,
        message:
          "Session token bai samu ba.",
      });
    }

    const tokenHash =
      hashSessionToken(token);

    const session =
      await prisma.webSession.findUnique({
        where: {
          tokenHash,
        },

        include: {
          user: true,
        },
      });

    if (!session) {
      return res.status(401).json({
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

      return res.status(401).json({
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

    return res.status(500).json({
      success: false,
      message:
        "An samu matsala wajen tabbatar da account.",
    });
  }
}
// ======================================================
// REGISTER WEB AUTH HANDLERS
// ======================================================

registerWebAuthHandlers(app, { requireWebUser });
// ======================================================
// NIGFILM PREMIUM PLANS
// ======================================================
const PREMIUM_PLANS = {
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

function getPremiumExpiryDate(
  planKey,
  startDate = new Date()
) {
  const plan =
    PREMIUM_PLANS[planKey];

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

async function getActivePremium(
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

  const now =
    new Date();

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

async function hasActivePremium(
  webUserId
) {
  const subscription =
    await getActivePremium(
      webUserId
    );

  return Boolean(subscription);
}
// ======================================================
// REGISTER WEB MOVIE HANDLERS
// ======================================================

registerWebMovieHandlers(app, {
  hasActivePremium,
});
// ======================================================
// WATCH 5 ADS - CONFIG
// ======================================================

const AD_UNLOCK_REQUIRED_ADS = 5;
const AD_UNLOCK_DURATION_MS =
  24 * 60 * 60 * 1000;

const AD_ATTEMPT_DURATION_MS =
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

async function getActiveAdMovieUnlock(
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

async function hasActiveAdMovieUnlock(
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
// =================================
// REQUIRE ADMIN
// =================================

async function requireAdmin(
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
      return res.status(401).json({
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
      return res.status(401).json({
        success: false,
        message:
          "Session token bai samu ba.",
      });
    }

    const tokenHash =
      hashSessionToken(token);

    const session =
      await prisma.webSession.findUnique({
        where: {
          tokenHash,
        },

        include: {
          user: true,
        },
      });

    if (!session) {
      return res.status(401).json({
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

      return res.status(401).json({
        success: false,
        message:
          "Session ya Æ™are.",
      });
    }

    if (
      session.user.role !==
      "ADMIN"
    ) {
      return res.status(403).json({
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
      "âŒ REQUIRE ADMIN ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "An samu matsala wajen tabbatar da Admin.",
    });
  }
}
// ======================================================
// REGISTER ADMIN PASSWORD RESET HANDLERS
// ======================================================

registerAdminPasswordResetHandlers(app, { requireAdmin });
// ======================================================
// REGISTER BUNNY UPLOAD HANDLERS
// ======================================================

registerBunnyUploadHandlers(app, {
  requireAdmin,
});
// ======================================================
// WATCH 5 ADS - GET UNLOCK STATUS
// ======================================================

app.get(
  "/api/web/ads/unlock-status/:filmId",
  requireWebUser,
  async (req, res) => {
    try {
      const webUserId = req.webUser.id;
      const filmId = Number(
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
        unlock?.status === "UNLOCKED" &&
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
        unlock?.status === "UNLOCKED" &&
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

// ======================================================
// WATCH 5 ADS - START ATTEMPT
// ======================================================

app.post(
  "/api/web/ads/start-attempt",
  requireWebUser,
  async (req, res) => {
    try {
      const webUserId = req.webUser.id;
      const filmId = Number(
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

// ======================================================
// WATCH 5 ADS - COMPLETE ATTEMPT
// ======================================================

app.post(
  "/api/web/ads/complete-attempt",
  requireWebUser,
  async (req, res) => {
    try {
      const webUserId = req.webUser.id;

      const filmId = Number(
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
        attempt.webUserId !== webUserId ||
        attempt.filmId !== filmId
      ) {
        return res.status(403).json({
          success: false,
          message:
            "Ad attempt bai dace ba.",
        });
      }

      if (attempt.status === "REWARDED") {
        return res.status(409).json({
          success: false,
          message:
            "An riga an kirga wannan Ad.",
        });
      }

      if (attempt.status !== "PENDING") {
        return res.status(409).json({
          success: false,
          message:
            "Wannan Ad attempt baya aiki.",
        });
      }

      if (
        attempt.expiresAt <= new Date()
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
                id: freshAttempt.id,
              },
              data: {
                status: "REWARDED",
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
                  unlockedAt: null,
                  expiresAt: null,
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
                    id: unlock.id,
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
// ======================================================
// PUSH NOTIFICATIONS - REGISTER DEVICE
// ======================================================

app.post(
  "/api/web/push/register",
  requireWebUser,
  async (req, res) => {
    try {
      const webUserId = req.webUser.id;

      const token = String(
        req.body?.token || ""
      ).trim();

      const platform = String(
        req.body?.platform || "android"
      )
        .trim()
        .toLowerCase();

      if (!token || token.length < 20) {
        return res.status(400).json({
          success: false,
          message: "FCM token bai dace ba.",
        });
      }

      if (
        !["android", "ios"].includes(platform)
      ) {
        return res.status(400).json({
          success: false,
          message: "Platform bai dace ba.",
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
// ======================================================
// WEB PREMIUM - GET PREMIUM STATUS
// ======================================================

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
// ======================================================
// WEB PREMIUM - GET PLANS
// ======================================================

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
// ======================================================
// WEB PREMIUM - INITIALIZE PAYMENT
// ======================================================

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

      // =================================
      // VALIDATE PLAN
      // =================================

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

      // =================================
      // CHECK PAYSTACK CONFIG
      // =================================

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

      // =================================
      // CHECK USER
      // =================================

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

      // =================================
      // CREATE PAYMENT REFERENCE
      // =================================

      const reference =
        `PREMIUM_${user.id}_${requestedPlan}_${Date.now()}_${crypto
          .randomBytes(4)
          .toString("hex")}`;

      // =================================
      // CREATE PREMIUM ORDER
      // =================================

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
                `premium${user.id}@nigfilm.app`,

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

      // =================================
      // PAYSTACK FAILED
      // =================================

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

      // =================================
      // RESPONSE
      // =================================

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

// ======================================================
// ADMIN - PREPARE TRAILER UPLOAD
// ======================================================

app.post(
  "/api/admin/bunny/prepare-trailer-upload",
  requireAdmin,
  async (req, res) => {
    try {
      const filmId = Number(req.body?.filmId);

      if (!Number.isInteger(filmId) || filmId <= 0) {
        return res.status(400).json({
          success: false,
          message: "Film ID bai dace ba.",
        });
      }

      const libraryId =
        process.env.BUNNY_STREAM_LIBRARY_ID;

      const apiKey =
        process.env.BUNNY_STREAM_API_KEY;

      if (!libraryId || !apiKey) {
        return res.status(500).json({
          success: false,
          message: "Bunny Stream config bai cika ba.",
        });
      }

      const film = await prisma.film.findUnique({
        where: {
          id: filmId,
        },

        select: {
          id: true,
          title: true,
          trailerBunnyVideoId: true,
          trailerUrl: true,
          trailerEnabled: true,
        },
      });

      if (!film) {
        return res.status(404).json({
          success: false,
          message: "Ba a samu wannan film ba.",
        });
      }

      if (film.trailerBunnyVideoId) {
        return res.status(409).json({
          success: false,
          alreadyExists: true,
          message:
            "Wannan film yana da trailer. Yi amfani da Replace Trailer.",
        });
      }

      // Create a fresh Bunny video for trailer
      const bunnyResponse = await fetch(
        `https://video.bunnycdn.com/library/${libraryId}/videos`,
        {
          method: "POST",

          headers: {
            AccessKey: apiKey,
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            title: `${film.title} - TRAILER`,
          }),
        }
      );

      const bunnyData =
        await bunnyResponse.json();

      if (
        !bunnyResponse.ok ||
        !bunnyData?.guid
      ) {
        console.error(
          "❌ BUNNY TRAILER CREATE ERROR:",
          bunnyData
        );

        return res.status(502).json({
          success: false,
          message:
            "An kasa ƙirƙirar trailer a Bunny Stream.",
        });
      }

      const trailerBunnyVideoId =
        bunnyData.guid;

      const trailerUrl =
        `https://player.mediadelivery.net/embed/` +
        `${libraryId}/` +
        `${trailerBunnyVideoId}`;

      // Store video ID, but do NOT publish until upload succeeds
      await prisma.film.update({
        where: {
          id: filmId,
        },

        data: {
          trailerBunnyVideoId,
          trailerUrl,
          trailerEnabled: false,
        },
      });

      // Create TUS signature
      const expirationTime =
        Math.floor(Date.now() / 1000) +
        6 * 60 * 60;

      const signatureString =
        `${libraryId}` +
        `${apiKey}` +
        `${expirationTime}` +
        `${trailerBunnyVideoId}`;

      const signature =
        crypto
          .createHash("sha256")
          .update(signatureString)
          .digest("hex");

      console.log(
        "✅ TRAILER UPLOAD PREPARED:",
        {
          filmId,
          trailerBunnyVideoId,
        }
      );

      return res.status(200).json({
        success: true,

        film: {
          id: film.id,
          title: film.title,
        },

        upload: {
          endpoint:
            "https://video.bunnycdn.com/tusupload",

          libraryId:
            String(libraryId),

          videoId:
            trailerBunnyVideoId,

          authorizationSignature:
            signature,

          authorizationExpire:
            String(expirationTime),
        },
      });
    } catch (error) {
      console.error(
        "❌ PREPARE TRAILER UPLOAD ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "An samu matsala wajen shirya trailer upload.",
      });
    }
  }
);

// ======================================================
// ADMIN - TRAILER UPLOAD COMPLETE
// ======================================================

app.post(
  "/api/admin/bunny/trailer-upload-complete",
  requireAdmin,
  async (req, res) => {
    try {
      const filmId = Number(req.body?.filmId);

      if (!Number.isInteger(filmId) || filmId <= 0) {
        return res.status(400).json({
          success: false,
          message: "Film ID bai dace ba.",
        });
      }

      const film = await prisma.film.findUnique({
        where: {
          id: filmId,
        },

        select: {
          id: true,
          title: true,
          trailerBunnyVideoId: true,
          trailerUrl: true,
        },
      });

      if (!film) {
        return res.status(404).json({
          success: false,
          message: "Ba a samu wannan film ba.",
        });
      }

      if (!film.trailerBunnyVideoId) {
        return res.status(409).json({
          success: false,
          message:
            "Trailer Bunny Video ID bai samu ba.",
        });
      }

      const updatedFilm =
        await prisma.film.update({
          where: {
            id: filmId,
          },

          data: {
            trailerEnabled: true,
          },

          select: {
            id: true,
            title: true,
            trailerBunnyVideoId: true,
            trailerUrl: true,
            trailerEnabled: true,
          },
        });

      console.log(
        "✅ TRAILER ENABLED:",
        filmId
      );

      return res.status(200).json({
        success: true,
        message:
          "Trailer upload ya gama kuma an kunna shi.",
        film: updatedFilm,
      });
    } catch (error) {
      console.error(
        "❌ TRAILER COMPLETE ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "An samu matsala wajen kammala trailer.",
      });
    }
  }
);

// ======================================================
// ADMIN - PREPARE TRAILER REPLACE
// ======================================================

app.post(
  "/api/admin/bunny/prepare-trailer-replace",
  requireAdmin,
  async (req, res) => {
    try {
      const filmId = Number(req.body?.filmId);

      if (!Number.isInteger(filmId) || filmId <= 0) {
        return res.status(400).json({
          success: false,
          message: "Film ID bai dace ba.",
        });
      }

      const libraryId =
        process.env.BUNNY_STREAM_LIBRARY_ID;

      const apiKey =
        process.env.BUNNY_STREAM_API_KEY;

      if (!libraryId || !apiKey) {
        return res.status(500).json({
          success: false,
          message: "Bunny Stream config bai cika ba.",
        });
      }

      const film = await prisma.film.findUnique({
        where: {
          id: filmId,
        },

        select: {
          id: true,
          title: true,
          trailerBunnyVideoId: true,
          trailerUrl: true,
          trailerEnabled: true,
        },
      });

      if (!film) {
        return res.status(404).json({
          success: false,
          message: "Ba a samu wannan film ba.",
        });
      }

      if (!film.trailerBunnyVideoId) {
        return res.status(409).json({
          success: false,
          message:
            "Wannan film bai da trailer. Ka fara Upload Trailer.",
        });
      }

      // Confirm trailer exists in Bunny
      const bunnyResponse = await fetch(
        `https://video.bunnycdn.com/library/${libraryId}/videos/${film.trailerBunnyVideoId}`,
        {
          headers: {
            AccessKey: apiKey,
            Accept: "application/json",
          },
        }
      );

      if (!bunnyResponse.ok) {
        const errorText =
          await bunnyResponse.text();

        console.error(
          "❌ TRAILER REPLACE CHECK ERROR:",
          bunnyResponse.status,
          errorText
        );

        return res.status(502).json({
          success: false,
          message:
            "An kasa tabbatar da existing trailer a Bunny.",
        });
      }

      const expirationTime =
        Math.floor(Date.now() / 1000) +
        6 * 60 * 60;

      const signatureString =
        `${libraryId}` +
        `${apiKey}` +
        `${expirationTime}` +
        `${film.trailerBunnyVideoId}`;

      const signature =
        crypto
          .createHash("sha256")
          .update(signatureString)
          .digest("hex");

      return res.status(200).json({
        success: true,

        film: {
          id: film.id,
          title: film.title,
        },

        upload: {
          endpoint:
            "https://video.bunnycdn.com/tusupload",

          libraryId:
            String(libraryId),

          videoId:
            film.trailerBunnyVideoId,

          authorizationSignature:
            signature,

          authorizationExpire:
            String(expirationTime),
        },
      });
    } catch (error) {
      console.error(
        "❌ PREPARE TRAILER REPLACE ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "An samu matsala wajen shirya Replace Trailer.",
      });
    }
  }
);

// ======================================================
// ADMIN - TRAILER STATUS
// ======================================================

app.get(
  "/api/admin/bunny/trailer-status/:filmId",
  requireAdmin,
  async (req, res) => {
    try {
      const filmId =
        Number(req.params.filmId);

      if (!Number.isInteger(filmId) || filmId <= 0) {
        return res.status(400).json({
          success: false,
          message: "Film ID bai dace ba.",
        });
      }

      const film = await prisma.film.findUnique({
        where: {
          id: filmId,
        },

        select: {
          id: true,
          title: true,
          trailerBunnyVideoId: true,
          trailerUrl: true,
          trailerEnabled: true,
        },
      });

      if (!film) {
        return res.status(404).json({
          success: false,
          message: "Ba a samu wannan film ba.",
        });
      }

      if (!film.trailerBunnyVideoId) {
        return res.status(200).json({
          success: true,

          trailer: {
            connected: false,
            enabled: false,
            videoId: null,
            statusCode: null,
            label: "No Trailer",
            progress: 0,
            ready: false,
            playable: false,
            failed: false,
            resolutions: [],
          },
        });
      }

      const libraryId =
        process.env.BUNNY_STREAM_LIBRARY_ID;

      const apiKey =
        process.env.BUNNY_STREAM_API_KEY;

      if (!libraryId || !apiKey) {
        return res.status(500).json({
          success: false,
          message:
            "Bunny Stream config bai cika ba.",
        });
      }

      const bunnyResponse = await fetch(
        `https://video.bunnycdn.com/library/${libraryId}/videos/${film.trailerBunnyVideoId}`,
        {
          headers: {
            AccessKey: apiKey,
            Accept: "application/json",
          },
        }
      );

      if (!bunnyResponse.ok) {
        return res.status(502).json({
          success: false,
          message:
            "An kasa duba trailer a Bunny Stream.",
        });
      }

      const video =
        await bunnyResponse.json();

      const statusCode =
        Number(video.status);

      const labels = {
        0: "Created",
        1: "Uploaded",
        2: "Processing",
        3: "Ready",
        4: "Playable",
        5: "Failed",
        6: "Uploading",
        7: "Queued",
        8: "Failed",
      };

      const ready =
        statusCode === 3;

      const playable =
        statusCode === 3 ||
        statusCode === 4;

      const failed =
        statusCode === 5 ||
        statusCode === 8;

      const progress =
        Number.isFinite(
          Number(video.encodeProgress)
        )
          ? Math.max(
              0,
              Math.min(
                100,
                Number(
                  video.encodeProgress
                )
              )
            )
          : ready
            ? 100
            : 0;

      const resolutions =
        String(
          video.availableResolutions ||
            ""
        )
          .split(",")
          .map((item) =>
            item.trim()
          )
          .filter(Boolean);

      return res.status(200).json({
        success: true,

        trailer: {
          connected: true,

          enabled:
            Boolean(
              film.trailerEnabled
            ),

          videoId:
            film.trailerBunnyVideoId,

          trailerUrl:
            film.trailerUrl,

          statusCode,

          label:
            labels[statusCode] ||
            `Status ${statusCode}`,

          progress,
          ready,
          playable,
          failed,
          resolutions,
        },
      });
    } catch (error) {
      console.error(
        "❌ TRAILER STATUS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "An samu matsala wajen duba trailer status.",
      });
    }
  }
);

// ======================================================
// ADMIN - ENABLE / DISABLE TRAILER
// ======================================================

app.patch(
  "/api/admin/films/:filmId/trailer-enabled",
  requireAdmin,
  async (req, res) => {
    try {
      const filmId =
        Number(req.params.filmId);

      const enabled =
        req.body?.enabled === true;

      if (!Number.isInteger(filmId) || filmId <= 0) {
        return res.status(400).json({
          success: false,
          message: "Film ID bai dace ba.",
        });
      }

      const film = await prisma.film.findUnique({
        where: {
          id: filmId,
        },

        select: {
          id: true,
          trailerBunnyVideoId: true,
        },
      });

      if (!film) {
        return res.status(404).json({
          success: false,
          message: "Ba a samu wannan film ba.",
        });
      }

      if (
        enabled &&
        !film.trailerBunnyVideoId
      ) {
        return res.status(409).json({
          success: false,
          message:
            "Ba za a kunna trailer ba saboda babu trailer da aka upload.",
        });
      }

      const updated =
        await prisma.film.update({
          where: {
            id: filmId,
          },

          data: {
            trailerEnabled:
              enabled,
          },

          select: {
            id: true,
            title: true,
            trailerEnabled: true,
            trailerBunnyVideoId: true,
            trailerUrl: true,
          },
        });

      return res.status(200).json({
        success: true,
        message: enabled
          ? "An kunna trailer."
          : "An kashe trailer.",
        film: updated,
      });
    } catch (error) {
      console.error(
        "❌ TRAILER ENABLE/DISABLE ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "An samu matsala wajen canza trailer status.",
      });
    }
  }
);
// ======================================================
// ADMIN BUNNY UPLOAD PAGE
// ======================================================

app.get(
  "/admin/upload-film/:filmId",
  async (req, res) => {
    try {
      const filmId = Number(req.params.filmId);
      const token = String(req.query.token || "");

      if (
        !Number.isInteger(filmId) ||
        filmId <= 0
      ) {
        return res
          .status(400)
          .send("Invalid Film ID");
      }

      if (
        !process.env.ADMIN_UPLOAD_SECRET ||
        token !== process.env.ADMIN_UPLOAD_SECRET
      ) {
        return res
          .status(403)
          .send("Unauthorized");
      }

      const film =
        await prisma.film.findUnique({
          where: {
            id: filmId,
          },
        });

      if (!film) {
        return res
          .status(404)
          .send("Film not found");
      }

      if (!film.bunnyVideoId) {
        return res
          .status(400)
          .send(
            "Bunny Video ID bai samu ba tukuna."
          );
      }

      return res.status(200).send(`
<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8" />

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  />

  <title>NIGFILM Upload</title>

  <script src="https://cdn.jsdelivr.net/npm/tus-js-client@4/dist/tus.min.js"></script>

  <style>
    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      min-height: 100vh;

      display: flex;
      align-items: center;
      justify-content: center;

      padding: 20px;

      background: #070707;
      color: white;

      font-family: Arial, sans-serif;
    }

    .card {
      width: 100%;
      max-width: 600px;

      padding: 28px;

      background: #111111;

      border: 1px solid #2a2a2a;
      border-radius: 22px;
    }

    h1 {
      margin-top: 0;

      color: #d4af37;
    }

    .film {
      padding: 14px;

      margin-bottom: 20px;

      background: #181818;

      border-radius: 12px;
    }

    input {
      width: 100%;

      padding: 14px;

      color: white;
      background: #181818;

      border: 1px solid #333;
      border-radius: 11px;
    }

    button {
      width: 100%;

      margin-top: 15px;
      padding: 14px;

      border: none;
      border-radius: 11px;

      background: #d4af37;
      color: #080808;

      font-weight: 900;
      cursor: pointer;
    }

    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .progress-wrap {
      width: 100%;
      height: 18px;

      margin-top: 22px;

      overflow: hidden;

      background: #282828;

      border-radius: 30px;
    }

    .progress {
      width: 0%;
      height: 100%;

      background: #d4af37;

      transition: width 0.2s ease;
    }

    .status {
      margin-top: 12px;

      color: #aaa;

      line-height: 1.5;
    }

    .success {
      color: #4ade80;
    }

    .error {
      color: #f87171;
    }
  </style>
</head>

<body>

  <div class="card">

    <h1>
      🎬 NIGFILM Upload
    </h1>

    <div class="film">
      <strong>${escapeHtml(film.title)}</strong>
      <br />
      Film ID: ${film.id}
    </div>

    <input
      id="videoFile"
      type="file"
      accept="video/*"
    />

    <button
      id="uploadButton"
      type="button"
    >
      ⬆️ Upload Film
    </button>

    <div class="progress-wrap">
      <div
        id="progress"
        class="progress"
      ></div>
    </div>

    <div
      id="status"
      class="status"
    >
      Zaɓi video sannan ka danna Upload Film.
    </div>

  </div>

<script>

const filmId = ${film.id};
const token = ${JSON.stringify(token)};

const fileInput =
  document.getElementById("videoFile");

const button =
  document.getElementById("uploadButton");

const progress =
  document.getElementById("progress");

const status =
  document.getElementById("status");

button.addEventListener(
  "click",
  async () => {
    const file =
      fileInput.files[0];

    if (!file) {
      status.className =
        "status error";

      status.textContent =
        "❌ Ka zaɓi film tukuna.";

      return;
    }

    try {
      button.disabled = true;

      status.className =
        "status";

      status.textContent =
        "🔐 Ana karɓar upload credentials...";

      const credentialsResponse =
        await fetch(
          "/api/admin/bunny/upload-credentials",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              filmId,
              token,
            }),
          }
        );

      const credentials =
        await credentialsResponse.json();

      if (!credentialsResponse.ok) {
        throw new Error(
          credentials.message ||
          "An kasa samun upload credentials."
        );
      }

      const upload =
        new tus.Upload(
          file,
          {
            endpoint:
              "https://video.bunnycdn.com/tusupload",

            retryDelays: [
              0,
              3000,
              5000,
              10000,
              20000,
              60000,
            ],

            headers: {
              AuthorizationSignature:
                credentials.signature,

              AuthorizationExpire:
                String(
                  credentials.expirationTime
                ),

              VideoId:
                credentials.videoId,

              LibraryId:
                String(
                  credentials.libraryId
                ),
            },

            metadata: {
              filetype:
                file.type ||
                "video/mp4",

              title:
                file.name,
            },

            removeFingerprintOnSuccess:
              true,

            onError(error) {
              console.error(error);

              button.disabled = false;

              status.className =
                "status error";

              status.textContent =
                "❌ Upload ya samu matsala: " +
                error.message;
            },

            onProgress(
              bytesUploaded,
              bytesTotal
            ) {
              const percent =
                (
                  bytesUploaded /
                  bytesTotal *
                  100
                ).toFixed(2);

              progress.style.width =
                percent + "%";

              status.className =
                "status";

              status.textContent =
                "⬆️ Uploading: " +
                percent +
                "%";
            },

            async onSuccess() {
              progress.style.width =
                "100%";

              status.className =
                "status success";

              status.textContent =
                "✅ Upload ya gama. Bunny yana encoding film ɗin.";

              await fetch(
                "/api/admin/bunny/upload-complete",
                {
                  method: "POST",

                  headers: {
                    "Content-Type":
                      "application/json",
                  },

                  body: JSON.stringify({
                    filmId,
                    token,
                  }),
                }
              );
            },
          }
        );

      const previousUploads =
        await upload.findPreviousUploads();

      if (
        previousUploads.length
      ) {
        status.textContent =
          "♻️ An samu upload na baya. Ana ci gaba daga inda ya tsaya...";

        upload.resumeFromPreviousUpload(
          previousUploads[0]
        );
      }

      upload.start();

    } catch (error) {
      button.disabled = false;

      status.className =
        "status error";

      status.textContent =
        "❌ " + error.message;
    }
  }
);

</script>

</body>
</html>
      `);
    } catch (error) {
      console.error(
        "ADMIN UPLOAD PAGE ERROR:",
        error
      );

      return res
        .status(500)
        .send(
          "Upload page error"
        );
    }
  }
);
// ======================================================
// BUNNY TUS UPLOAD CREDENTIALS
// ======================================================

app.post(
  "/api/admin/bunny/upload-credentials",
  async (req, res) => {
    try {
      const filmId =
        Number(req.body?.filmId);

      const token =
        String(
          req.body?.token || ""
        );

      if (
        token !==
        process.env.ADMIN_UPLOAD_SECRET
      ) {
        return res.status(403).json({
          success: false,
          message:
            "Ba ka da izinin upload.",
        });
      }

      const film =
        await prisma.film.findUnique({
          where: {
            id: filmId,
          },
        });

      if (
        !film ||
        !film.bunnyVideoId
      ) {
        return res.status(404).json({
          success: false,
          message:
            "Film ko Bunny Video ID bai samu ba.",
        });
      }

      const libraryId =
        process.env
          .BUNNY_STREAM_LIBRARY_ID;

      const apiKey =
        process.env
          .BUNNY_STREAM_API_KEY;

      if (
        !libraryId ||
        !apiKey
      ) {
        return res.status(500).json({
          success: false,
          message:
            "Bunny config bai cika ba.",
        });
      }

      // 24 hours domin manyan films
      const expirationTime =
        Math.floor(
          Date.now() / 1000
        ) +
        24 * 60 * 60;

      const signature =
        crypto
          .createHash("sha256")
          .update(
            `${libraryId}${apiKey}${expirationTime}${film.bunnyVideoId}`
          )
          .digest("hex");

      return res.status(200).json({
        success: true,

        videoId:
          film.bunnyVideoId,

        libraryId,

        expirationTime,

        signature,
      });
    } catch (error) {
      console.error(
        "BUNNY UPLOAD CREDENTIALS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "An samu matsala wajen upload credentials.",
      });
    }
  }
);
// ======================================================
// TELEGRAM PURCHASE DOWNLOAD
// ======================================================

app.get(
  "/api/telegram/movies/:filmId/download",
  async (req, res) => {
    try {
      const filmId = Number(
        req.params.filmId
      );

      const telegramId = String(
        req.query.telegramId || ""
      ).trim();

      if (
        !Number.isInteger(filmId) ||
        filmId <= 0 ||
        !telegramId
      ) {
        return res
          .status(400)
          .send("Invalid request.");
      }

      // =================================
      // VERIFY PURCHASE
      // =================================

      const purchase =
        await prisma.purchase.findFirst({
          where: {
            telegramId,
            filmId,
          },

          include: {
            film: true,
          },
        });

      if (!purchase) {
        return res
          .status(403)
          .send(
            "Ba ka sayi wannan film ba."
          );
      }

      const film =
        purchase.film;

      if (!film?.bunnyVideoId) {
        return res
          .status(404)
          .send(
            "Ba a samu video ɗin wannan film ba."
          );
      }

      // =================================
      // BUNNY CONFIG
      // =================================

      const hostname =
        process.env
          .BUNNY_STREAM_CDN_HOSTNAME;

      const tokenKey =
        process.env
          .BUNNY_STREAM_TOKEN_KEY;

      if (
        !hostname ||
        !tokenKey
      ) {
        console.error(
          "BUNNY DOWNLOAD CONFIG MISSING"
        );

        return res
          .status(500)
          .send(
            "Download config bai cika ba."
          );
      }

      const cleanHostname =
        hostname
          .replace(
            /^https?:\/\//,
            ""
          )
          .replace(
            /\/+$/,
            ""
          );

      // =================================
      // MP4 FILE
      // =================================
      //
      // Idan video ɗin ba shi da 720p,
      // daga baya za mu sa automatic
      // resolution detection.
      //

      const filePath =
        `/${film.bunnyVideoId}/play_720p.mp4`;

      // Signed URL expires in 1 hour
      const expires =
        Math.floor(
          Date.now() / 1000
        ) +
        60 * 60;

      const tokenBase =
        tokenKey +
        filePath +
        expires;

      const token =
        crypto
          .createHash("sha256")
          .update(tokenBase)
          .digest("base64")
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=/g, "");

      const bunnyUrl =
        `https://${cleanHostname}${filePath}` +
        `?token=${token}` +
        `&expires=${expires}`;

      // =================================
      // SUPPORT RESUME / RANGE
      // =================================

      const requestHeaders = {};

      const range =
        req.headers.range;

      if (range) {
        requestHeaders.Range =
          range;
      }

      // =================================
      // FETCH FROM BUNNY
      // =================================

      const bunnyResponse =
        await fetch(
          bunnyUrl,
          {
            headers:
              requestHeaders,
          }
        );

      if (
        !bunnyResponse.ok &&
        bunnyResponse.status !==
          206
      ) {
        console.error(
          "BUNNY DOWNLOAD FETCH ERROR:",
          bunnyResponse.status
        );

        return res
          .status(
            bunnyResponse.status
          )
          .send(
            "An kasa ɗauko film daga server."
          );
      }

      // =================================
      // DOWNLOAD FILE NAME
      // =================================

      const safeTitle =
        String(
          film.title ||
          `NIGFILM-${film.id}`
        )
          .replace(
            /[<>:"/\\|?*\x00-\x1F]/g,
            ""
          )
          .trim() ||
        `NIGFILM-${film.id}`;

      // =================================
      // FORCE DOWNLOAD
      // =================================

      res.status(
        bunnyResponse.status
      );

      res.setHeader(
        "Content-Type",
        bunnyResponse.headers.get(
          "content-type"
        ) ||
          "video/mp4"
      );
     res.setHeader(
  "Access-Control-Allow-Origin",
  "https://web.telegram.org"
);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${safeTitle}.mp4"`
      );

      const contentLength =
        bunnyResponse.headers.get(
          "content-length"
        );

      if (contentLength) {
        res.setHeader(
          "Content-Length",
          contentLength
        );
      }

      const contentRange =
        bunnyResponse.headers.get(
          "content-range"
        );

      if (contentRange) {
        res.setHeader(
          "Content-Range",
          contentRange
        );
      }

      const acceptRanges =
        bunnyResponse.headers.get(
          "accept-ranges"
        );

      if (acceptRanges) {
        res.setHeader(
          "Accept-Ranges",
          acceptRanges
        );
      } else {
        res.setHeader(
          "Accept-Ranges",
          "bytes"
        );
      }

      res.setHeader(
        "Cache-Control",
        "private, no-store"
      );

      if (
        !bunnyResponse.body
      ) {
        return res
          .status(502)
          .end();
      }

      // =================================
      // STREAM — BA BUFFER BA
      // =================================

      const stream =
        Readable.fromWeb(
          bunnyResponse.body
        );

      stream.on(
        "error",
        (error) => {
          console.error(
            "DOWNLOAD STREAM ERROR:",
            error
          );

          if (!res.headersSent) {
            res.sendStatus(500);
          } else {
            res.destroy(
              error
            );
          }
        }
      );

      stream.pipe(res);
    } catch (error) {
      console.error(
        "TELEGRAM DOWNLOAD ERROR:",
        error
      );

      if (
        !res.headersSent
      ) {
        return res
          .status(500)
          .send(
            "An samu matsala wajen sauke film."
          );
      }

      return res.end();
    }
  }
);
// ======================================================
// TELEGRAM WATCH PAGE
// ======================================================

app.get(
  "/telegram/watch/:filmId",
  async (req, res) => {
    try {
      const filmId = Number(
        req.params.filmId
      );

      const telegramId = String(
        req.query.telegramId || ""
      ).trim();

      if (
        !Number.isInteger(filmId) ||
        filmId <= 0 ||
        !telegramId
      ) {
        return res
          .status(400)
          .send("Invalid request.");
      }

      const purchase =
        await prisma.purchase.findFirst({
          where: {
            telegramId,
            filmId,
          },

          include: {
            film: true,
          },
        });

      if (!purchase) {
        return res
          .status(403)
          .send(
            "Ba ka sayi wannan film ba."
          );
      }

      const film =
        purchase.film;

      if (!film?.webVideoUrl) {
        return res
          .status(404)
          .send(
            "Film player bai samu ba."
          );
      }

      return res.status(200).send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  />

  <title>${escapeHtml(film.title)}</title>

  <style>
    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      min-height: 100vh;

      background: #000;
      color: white;

      font-family:
        Arial,
        sans-serif;
    }

    .page {
      min-height: 100vh;

      display: flex;
      flex-direction: column;
    }

    .header {
      padding: 16px;

      background: #0b0b0b;

      border-bottom:
        1px solid #222;
    }

    .brand {
      color: #d4af37;

      font-size: 20px;
      font-weight: 900;
    }

    .title {
      margin-top: 8px;

      font-size: 16px;
      color: #ddd;
    }

    .player {
      flex: 1;

      min-height: 70vh;
    }

    iframe {
      width: 100%;
      height: 100%;

      min-height: 70vh;

      border: 0;

      background: #000;
    }
  </style>
</head>

<body>

  <div class="page">

    <div class="header">
      <div class="brand">
        NIGFILM
      </div>

      <div class="title">
        🎬 ${escapeHtml(film.title)}
      </div>
    </div>

    <div class="player">
      <iframe
        src="${escapeHtml(film.webVideoUrl)}"
        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
        allowfullscreen
      ></iframe>
    </div>

  </div>

</body>
</html>
      `);
    } catch (error) {
      console.error(
        "TELEGRAM WATCH PAGE ERROR:",
        error
      );

      return res
        .status(500)
        .send(
          "An samu matsala wajen buɗe film."
        );
    }
  }
);
// ======================================================
// TELEGRAM DOWNLOAD MINI APP
// ======================================================

app.get(
  "/telegram/download/:filmId",
  async (req, res) => {
    try {
      const filmId = Number(req.params.filmId);

      const telegramId = String(
        req.query.telegramId || ""
      ).trim();

      if (
        !Number.isInteger(filmId) ||
        filmId <= 0 ||
        !telegramId
      ) {
        return res
          .status(400)
          .send("Invalid request.");
      }

      const purchase =
        await prisma.purchase.findFirst({
          where: {
            telegramId,
            filmId,
          },

          include: {
            film: true,
          },
        });

      if (!purchase?.film) {
        return res
          .status(403)
          .send(
            "Ba ka mallaki wannan film ba."
          );
      }

      const film = purchase.film;

      if (!film.bunnyVideoId) {
        return res
          .status(404)
          .send(
            "Download bai samu ba."
          );
      }

      const baseUrl =
        process.env.PUBLIC_BASE_URL ||
        "https://nigfilm-bot.onrender.com";

      const downloadUrl =
        `${baseUrl}/api/telegram/movies/${film.id}/download?telegramId=${encodeURIComponent(
          telegramId
        )}`;

      const safeTitle = String(
        film.title || `NIGFILM-${film.id}`
      )
        .replace(/[<>:"/\\|?*]/g, "")
        .trim();

      return res.status(200).send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  >

  <title>Download Movie</title>

  <script src="https://telegram.org/js/telegram-web-app.js"></script>

  <style>
    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      min-height: 100vh;

      display: flex;
      align-items: center;
      justify-content: center;

      padding: 20px;

      background: #080808;
      color: #fff;

      font-family:
        Arial,
        sans-serif;
    }

    .card {
      width: 100%;
      max-width: 480px;

      padding: 28px;

      text-align: center;

      background: #121212;

      border:
        1px solid #292929;

      border-radius: 22px;
    }

    h1 {
      color: #d4af37;
    }

    p {
      color: #bbb;

      line-height: 1.6;
    }

    button {
      width: 100%;

      padding: 15px;

      margin-top: 15px;

      border: 0;
      border-radius: 12px;

      background: #d4af37;
      color: #080808;

      font-size: 16px;
      font-weight: 800;

      cursor: pointer;
    }

    #status {
      margin-top: 15px;

      color: #aaa;
    }
  </style>
</head>

<body>

  <div class="card">

    <h1>
      🎬 NIGFILM
    </h1>

    <h2>
      ${escapeHtml(film.title)}
    </h2>

    <p>
      Danna maballin da ke ƙasa domin
      sauke film ɗin zuwa na'urarka.
    </p>

    <button
      id="downloadButton"
      type="button"
    >
      ⬇️ Download Movie
    </button>

    <div id="status"></div>

  </div>

<script>
  const tg =
    window.Telegram?.WebApp;

  if (tg) {
    tg.ready();
    tg.expand();
  }

  const button =
    document.getElementById(
      "downloadButton"
    );

  const status =
    document.getElementById(
      "status"
    );

  button.addEventListener(
    "click",
    () => {
      if (
        !tg ||
        typeof tg.downloadFile !==
          "function"
      ) {
        status.textContent =
          "Telegram ɗinka bai goyi bayan native download ba.";

        return;
      }

      status.textContent =
        "Ana shirya download...";

      tg.downloadFile(
        {
          url: ${JSON.stringify(downloadUrl)},
          file_name: ${JSON.stringify(
            `${safeTitle}.mp4`
          )},
        },

        (accepted) => {
          status.textContent =
            accepted
              ? "✅ Download ya fara."
              : "An soke download.";
        }
      );
    }
  );
</script>

</body>
</html>
      `);
    } catch (error) {
      console.error(
        "TELEGRAM DOWNLOAD PAGE ERROR:",
        error
      );

      return res
        .status(500)
        .send(
          "An samu matsala wajen buɗe download."
        );
    }
  }
);
// ======================================================
// NEXT SECTION
// ======================================================
// ======================================================
// TELEGRAM WEBHOOK
// ======================================================

app.post(
  "/telegram-webhook",
  async (req, res) => {
    try {
      await bot.handleUpdate(
        req.body
      );

      return res.sendStatus(200);
    } catch (error) {
      console.error(
        "âŒ TELEGRAM WEBHOOK ERROR:",
        error
      );

      return res.sendStatus(500);
    }
  }
);

// ======================================================
// HEALTH CHECK
// ======================================================

app.get("/", (req, res) => {
  return res.status(200).json({
    success: true,
    service: "NIGFILM",

    message:
      "âœ… NIGFILM BOT & WEB API suna aiki!",
  });
});

app.get(
  "/api/health",
  (req, res) => {
    return res.status(200).json({
      success: true,
      service:
        "NIGFILM API",

      database:
        "PostgreSQL",

      status:
        "online",
    });
  }
);

// ======================================================
// TELEGRAM PAYMENT SUCCESS PAGE
// ======================================================

app.get(
  "/payment-success",
  (req, res) => {
    return res.status(200).send(`
<!DOCTYPE html>

<html lang="en">

<head>

<meta charset="UTF-8" />

<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0"
/>

<title>
Payment Successful
</title>

<style>

body {
  margin: 0;
  min-height: 100vh;

  display: flex;
  align-items: center;
  justify-content: center;

  background: #0b0b0d;
  color: white;

  font-family:
    Arial,
    sans-serif;
}

.card {
  width: 90%;
  max-width: 450px;

  padding: 32px;

  border-radius: 20px;

  background: #18181b;

  text-align: center;

  box-shadow:
    0 20px 50px
    rgba(0, 0, 0, 0.35);
}

.icon {
  font-size: 58px;
}

h1 {
  color: #22c55e;
}

p {
  color: #d4d4d8;
  line-height: 1.7;
}

a {
  display: inline-block;

  margin-top: 16px;

  padding: 13px 24px;

  border-radius: 12px;

  background: #d4af37;

  color: #080808;

  text-decoration: none;

  font-weight: bold;
}

</style>

</head>

<body>

<div class="icon">
✅
</div>

<h1>
Payment Successful
</h1>

<p>
An karɓi biyan kuɗinka cikin nasara.
Ka koma Telegram domin karɓar film ɗinka.
</p>

<a href="https://t.me/Nigfilm_bot">
Buɗe NIGFILM BOT
</a>

</div>

</body>

</html>
    `);
  }
);
// ======================================================
// PAYSTACK WEBHOOK
// ======================================================

registerWebhookHandlers(app);
// ======================================================
// WEB SESSION HELPERS
// ======================================================


// ======================================================
// WEB PAYMENT HTML
// ======================================================
function buildWebPaymentPage({
  success,
  title,
  message,
  returnUrl = "https://nigfilm-web.vercel.app",
}) {
  const icon =
    success ? "✅" : "❌";

  const headingColor =
    success
      ? "#d4af37"
      : "#ef4444";

  return `
<!DOCTYPE html>

<html lang="en">

<head>

<meta charset="UTF-8" />

<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0"
/>

<title>
${escapeHtml(title)}
</title>

<style>

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;

  display: flex;
  align-items: center;
  justify-content: center;

  padding: 20px;

  background: #070707;
  color: white;

  font-family:
    Arial,
    sans-serif;
}

.card {
  width: 100%;
  max-width: 460px;

  padding: 35px 25px;

  text-align: center;

  background: #121212;

  border: 1px solid #292929;
  border-radius: 22px;

  box-shadow:
    0 20px 60px
    rgba(0, 0, 0, 0.45);
}

.icon {
  font-size: 60px;
}

h1 {
  margin: 15px 0 10px;

  color:
    ${headingColor};
}

p {
  color: #aaaaaa;

  line-height: 1.7;
}

a {
  display: inline-block;

  margin-top: 22px;

  padding: 14px 22px;

  background: #d4af37;
  color: #080808;

  border-radius: 11px;

  text-decoration: none;

  font-weight: 900;
}

</style>

</head>

<body>

<div class="card">

<div class="icon">
${icon}
</div>

<h1>
${escapeHtml(title)}
</h1>

<p>
${escapeHtml(message)}
</p>

<a href="${escapeHtml(returnUrl)}">
Komawa NIGFILM
</a>

</div>

</body>

</html>
  `;
}

function escapeHtml(
  value
) {
  return String(
    value || ""
  )
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );
}
// ======================================================
// REGISTER WEB PAYMENT HANDLERS
// ======================================================

registerWebPaymentHandlers(app, {
  PUBLIC_BASE_URL,
  WEB_APP_URL,
  verifyPaystackTransaction,
  processWebFilmPayment,
  processPremiumPayment,
  buildWebPaymentPage,
});
// ======================================================
// START SERVER
// ======================================================

const server =
  app.listen(
    PORT,
    async () => {
      console.log(
        `ðŸŒ NIGFILM server yana aiki a port ${PORT}`
      );

      try {
        await bot.telegram.deleteWebhook({
          drop_pending_updates: false
        });

        await bot.launch();

        console.log(
          "Telegram polling started successfully."
        );
      } catch (error) {
        console.error(
          "START TELEGRAM POLLING ERROR:",
          error
        );
      }
    }
  );

console.log(
  "ðŸ¤– NIGFILM BOT & WEB API started successfully."
);

// ======================================================
// GRACEFUL SHUTDOWN
// ======================================================

let isShuttingDown =
  false;

async function gracefulShutdown(
  signal
) {
  if (
    isShuttingDown
  ) {
    return;
  }

  isShuttingDown =
    true;

  console.log(
    `ðŸ›‘ Ana rufe server saboda ${signal}...`
  );

  server.close(
    async () => {
      try {
        try {
          bot.stop(signal);
        } catch {}

        await prisma.$disconnect();

        console.log(
          "âœ… Prisma da server sun rufe lafiya."
        );

        process.exit(0);
      } catch (error) {
        console.error(
          "âŒ SHUTDOWN ERROR:",
          error
        );

        process.exit(1);
      }
    }
  );

  setTimeout(() => {
    console.error(
      "âŒ Graceful shutdown timeout."
    );

    process.exit(1);
  }, 10000).unref();
}

process.once(
  "SIGINT",
  () => {
    gracefulShutdown(
      "SIGINT"
    );
  }
);

process.once(
  "SIGTERM",
  () => {
    gracefulShutdown(
      "SIGTERM"
    );
  }
);
