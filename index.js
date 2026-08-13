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

const TELEGRAM_WEBHOOK_URL =
  process.env.TELEGRAM_WEBHOOK_URL ||
  "https://nigfilm-bot.onrender.com/telegram-webhook";

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
// ======================================================
// NIGFILM WEB API
// ======================================================

// ======================================================
// GET ALL FILMS
// ======================================================

app.get("/api/films", async (req, res) => {
  try {
    const films = await prisma.film.findMany({
      orderBy: {
        createdAt: "desc",
      },

      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        price: true,
        posterFileId: true,

        bunnyVideoId: true,
webVideoUrl: true,
        createdAt: true,
      },
    });

    const result = films.map((film) => ({
      ...film,

      posterUrl:
        `/api/films/${film.id}/poster`,
    }));

    return res.status(200).json({
      success: true,
      count: result.length,
      films: result,
    });
  } catch (error) {
    console.error(
      "âŒ GET FILMS API ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "An samu matsala wajen É—auko fina-finai.",
    });
  }
});

// ======================================================
// GET SINGLE FILM
// ======================================================

app.get(
  "/api/films/:id",
  async (req, res) => {
    try {
      const filmId =
        Number(req.params.id);

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
            title: true,
            description: true,
            category: true,
            price: true,
            posterFileId: true,
            createdAt: true,
          },
        });

      if (!film) {
        return res.status(404).json({
          success: false,
          message:
            "Ba a samu wannan film ba.",
        });
      }

      return res.status(200).json({
        success: true,

        film: {
          ...film,

          posterUrl:
            `/api/films/${film.id}/poster`,
        },
      });
    } catch (error) {
      console.error(
        "âŒ GET SINGLE FILM API ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "An samu matsala wajen É—auko film.",
      });
    }
  }
);

// ======================================================
// GET CATEGORIES
// ======================================================

app.get(
  "/api/categories",
  async (req, res) => {
    try {
      const films =
        await prisma.film.findMany({
          select: {
            category: true,
          },
        });

      const categories = [
        ...new Set(
          films
            .map(
              (film) =>
                film.category
            )
            .filter(Boolean)
        ),
      ].sort();

      return res.status(200).json({
        success: true,
        count: categories.length,
        categories,
      });
    } catch (error) {
      console.error(
        "âŒ GET CATEGORIES API ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "An samu matsala wajen É—auko categories.",
      });
    }
  }
);

// ======================================================
// SEARCH FILMS
// ======================================================

app.get(
  "/api/search",
  async (req, res) => {
    try {
      const query = String(
        req.query.q || ""
      ).trim();

      if (!query) {
        return res.status(200).json({
          success: true,
          count: 0,
          films: [],
        });
      }

      const films =
        await prisma.film.findMany({
          where: {
            OR: [
              {
                title: {
                  contains: query,
                  mode: "insensitive",
                },
              },

              {
                description: {
                  contains: query,
                  mode: "insensitive",
                },
              },

              {
                category: {
                  contains: query,
                  mode: "insensitive",
                },
              },
            ],
          },

          orderBy: {
            createdAt: "desc",
          },

          select: {
            id: true,
            title: true,
            description: true,
            category: true,
            price: true,
            posterFileId: true,

bunnyVideoId: true,
webVideoUrl: true,

            createdAt: true,
          },
        });

      const result =
        films.map((film) => ({
          ...film,

          posterUrl:
            `/api/films/${film.id}/poster`,
        }));

      return res.status(200).json({
        success: true,
        count: result.length,
        films: result,
      });
    } catch (error) {
      console.error(
        "âŒ SEARCH FILMS API ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "An samu matsala wajen neman film.",
      });
    }
  }
);

// ======================================================
// FILM POSTER PROXY
// ======================================================

app.get(
  "/api/films/:id/poster",
  async (req, res) => {
    try {
      const filmId =
        Number(req.params.id);

      if (
        !Number.isInteger(filmId) ||
        filmId <= 0
      ) {
        return res.sendStatus(400);
      }

      const film =
        await prisma.film.findUnique({
          where: {
            id: filmId,
          },

          select: {
            posterFileId: true,
          },
        });

      if (
        !film ||
        !film.posterFileId
      ) {
        return res.sendStatus(404);
      }

      const fileLink =
        await bot.telegram.getFileLink(
          film.posterFileId
        );

      const response =
        await fetch(fileLink.href);

      if (!response.ok) {
        console.error(
          "âŒ TELEGRAM POSTER FETCH FAILED:",
          response.status
        );

        return res.sendStatus(502);
      }

      const contentType =
        response.headers.get(
          "content-type"
        ) || "image/jpeg";

      res.setHeader(
        "Content-Type",
        contentType
      );

      res.setHeader(
        "Cache-Control",
        "public, max-age=3600"
      );

      const imageBuffer =
        Buffer.from(
          await response.arrayBuffer()
        );

      return res.send(imageBuffer);
    } catch (error) {
      console.error(
        "âŒ POSTER API ERROR:",
        error
      );

      return res.sendStatus(500);
    }
  }
);
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

      // =================================
      // VALIDATION
      // =================================

      if (
        !fullName ||
        !phone ||
        !password
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Ka cika duk bayanan da ake buÆ™ata.",
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
            "Password ya zama aÆ™alla haruffa 6.",
        });
      }

      // =================================
      // CHECK EXISTING USER
      // =================================

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

      // =================================
      // HASH PASSWORD
      // =================================

      const passwordHash =
        hashPassword(password);

      // =================================
      // CREATE USER
      // =================================

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

      // =================================
      // CREATE WEB SESSION
      // =================================

      const session =
        await createWebSession(
          user.id
        );

      console.log(
        "âœ… WEB USER REGISTERED:",
        user.id
      );

      // =================================
      // RESPONSE
      // =================================

      return res.status(201).json({
        success: true,

        message:
          "Account an Æ™irÆ™ira cikin nasara.",

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
        "âŒ WEB REGISTER ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "An samu matsala wajen Æ™irÆ™irar account.",
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

      // =================================
      // VALIDATION
      // =================================

      if (!phone || !password) {
        return res.status(400).json({
          success: false,
          message:
            "Ka saka phone number da password.",
        });
      }

      // =================================
      // FIND USER
      // =================================

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

      // =================================
      // VERIFY PASSWORD
      // =================================

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

      // =================================
      // CREATE WEB SESSION
      // =================================

      const session =
        await createWebSession(
          user.id
        );

      console.log(
        "âœ… WEB USER LOGIN:",
        user.id,
        user.role
      );

      // =================================
      // RESPONSE
      // =================================

      return res.status(200).json({
        success: true,

        message:
          "Login ya yi nasara.",

        user: {
          id: user.id,
          fullName: user.fullName,
          phone: user.phone,
          role: user.role,
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
        "âŒ WEB LOGIN ERROR:",
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
                `${PUBLIC_BASE_URL}/web-payment-success`,

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
                "Payment Reference Missing",
              message:
                "Ba a samu payment reference ba.",
            })
          );
      }

      const verification =
        await verifyPaystackTransaction(
          reference
        );

      if (
        !verification.success
      ) {
        return res
          .status(400)
          .send(
            buildWebPaymentPage({
              success: false,
              title:
                "Payment Not Confirmed",
              message:
                verification.message,
            })
          );
      }

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
            })
          );
      }

      return res
        .status(200)
        .send(
          buildWebPaymentPage({
            success: true,

            title:
              "Payment Successful",

            message:
              "An tabbatar da payment É—inka. Film É—in ya shiga My Movies.",
          })
        );
    } catch (error) {
      console.error(
        "âŒ WEB PAYMENT CALLBACK ERROR:",
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
          })
        );
    }
  }
);

// ======================================================
// WEB MY MOVIES API
// ======================================================

app.get(
  "/api/web/users/:webUserId/movies",
  async (req, res) => {
    try {
      const webUserId =
        Number(
          req.params.webUserId
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
                bunnyVideoId: true,
                webVideoUrl: true,
                createdAt: true,
              },
            },
          },
        });

      const movies =
        purchases.map(
          (purchase) => ({
            purchaseId:
              purchase.id,

            purchasedAt:
              purchase.createdAt,

            ...purchase.film,

            posterUrl:
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
          "An samu matsala wajen É—auko My Movies.",
      });
    }
  }
);
// ======================================================
// WEB MOVIE VIDEO STREAM
// ======================================================

app.get(
  "/api/web/movies/:filmId/video",
  async (req, res) => {
    try {
      const filmId = Number(req.params.filmId);
      const webUserId = Number(req.query.webUserId);

      if (
        !Number.isInteger(filmId) ||
        filmId <= 0 ||
        !Number.isInteger(webUserId) ||
        webUserId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Film ID ko Web User ID bai dace ba.",
        });
      }

      // =================================
      // VERIFY PURCHASE
      // =================================

      const purchase =
        await prisma.webPurchase.findUnique({
          where: {
            webUserId_filmId: {
              webUserId,
              filmId,
            },
          },

          include: {
            film: true,
          },
        });

      if (!purchase) {
        return res.status(403).json({
          success: false,
          message:
            "Ba ka sayi wannan film ba.",
        });
      }

      const film = purchase.film;

      if (!film?.videoFileId) {
        return res.status(404).json({
          success: false,
          message:
            "Ba a samu video file na wannan film ba.",
        });
      }

      // =================================
      // GET TELEGRAM FILE LINK
      // =================================

      const fileLink =
        await bot.telegram.getFileLink(
          film.videoFileId
        );

      const telegramResponse =
        await fetch(fileLink.href);

      if (!telegramResponse.ok) {
        console.error(
          "âŒ TELEGRAM VIDEO FETCH FAILED:",
          telegramResponse.status
        );

        return res.status(502).json({
          success: false,
          message:
            "An kasa É—auko video daga Telegram.",
        });
      }

      const contentType =
        telegramResponse.headers.get(
          "content-type"
        ) || "video/mp4";

      const contentLength =
        telegramResponse.headers.get(
          "content-length"
        );

      res.setHeader(
        "Content-Type",
        contentType
      );

      if (contentLength) {
        res.setHeader(
          "Content-Length",
          contentLength
        );
      }

      res.setHeader(
        "Cache-Control",
        "private, no-store"
      );

      const buffer =
        Buffer.from(
          await telegramResponse.arrayBuffer()
        );

      return res.send(buffer);
    } catch (error) {
      console.error(
        "âŒ WEB VIDEO STREAM ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "An samu matsala wajen kunna film.",
      });
    }
  }
);
// ======================================================
// BUNNY STREAM - CREATE VIDEO
// ======================================================

app.post(
  "/api/admin/bunny/create-video",
  async (req, res) => {
    try {
      const filmId = Number(req.body?.filmId);

      if (
        !Number.isInteger(filmId) ||
        filmId <= 0
      ) {
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
          message:
            "Bunny Stream config bai cika ba.",
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

      // Idan video ya riga ya samu Bunny ID
      if (film.bunnyVideoId) {
        return res.status(200).json({
          success: true,
          alreadyExists: true,
          bunnyVideoId:
            film.bunnyVideoId,
          webVideoUrl:
            film.webVideoUrl,
        });
      }

      const bunnyResponse =
        await fetch(
          `https://video.bunnycdn.com/library/${libraryId}/videos`,
          {
            method: "POST",

            headers: {
              AccessKey: apiKey,
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              title: film.title,
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
          "âŒ BUNNY CREATE VIDEO ERROR:",
          bunnyData
        );

        return res.status(502).json({
          success: false,
          message:
            "An kasa Æ™irÆ™irar video a Bunny Stream.",
        });
      }

      const bunnyVideoId =
        bunnyData.guid;

      const webVideoUrl =
        `https://player.mediadelivery.net/embed/${libraryId}/${bunnyVideoId}`;

      await prisma.film.update({
        where: {
          id: film.id,
        },

        data: {
          bunnyVideoId,
          webVideoUrl,
        },
      });

      console.log(
        "âœ… BUNNY VIDEO CREATED:",
        {
          filmId: film.id,
          bunnyVideoId,
        }
      );

      return res.status(200).json({
        success: true,
        filmId: film.id,
        bunnyVideoId,
        webVideoUrl,
      });
    } catch (error) {
      console.error(
        "âŒ BUNNY CREATE VIDEO ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "An samu matsala wajen Æ™irÆ™irar Bunny video.",
      });
    }
  }
);
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
                bunnyVideoId: true,
                webVideoUrl: true,
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
          "An samu matsala wajen É—auko My Movies.",
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
      // VERIFY PURCHASE
      // =================================

      const purchase =
        await prisma.webPurchase.findFirst({
          where: {
            webUserId,
            filmId,
          },
        });

      if (!purchase) {
        return res.status(403).json({
          success: false,
          message:
            "Ba ka sayi wannan film ba.",
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
      // FETCH VIDEO FROM BUNNY
      // =================================

      const videoResponse =
        await fetch(
          bunnyDownloadUrl
        );

      if (
        !videoResponse.ok ||
        !videoResponse.body
      ) {
        const errorText =
          await videoResponse.text();

        console.error(
          "âŒ BUNNY DOWNLOAD FETCH ERROR:",
          videoResponse.status,
          errorText
        );

        return res.status(502).json({
          success: false,
          message:
            "An kasa É—auko film domin download.",
        });
      }

      // =================================
      // DOWNLOAD HEADERS
      // =================================

      const safeTitle =
        String(
          film.title ||
            "NIGFILM"
        )
          .replace(
            /[<>:"/\\|?*\x00-\x1F]/g,
            "_"
          )
          .trim();

      const fileName =
        `${safeTitle}.mp4`;

      res.setHeader(
        "Content-Type",
        videoResponse.headers.get(
          "content-type"
        ) || "video/mp4"
      );

      const contentLength =
        videoResponse.headers.get(
          "content-length"
        );

      if (contentLength) {
        res.setHeader(
          "Content-Length",
          contentLength
        );
      }

      // Wannan ne yake tilasta DOWNLOAD
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(
          fileName
        )}`
      );

      res.setHeader(
        "Cache-Control",
        "private, no-store"
      );

      console.log(
        "â¬‡ï¸ WEB MOVIE DOWNLOAD STARTED:",
        {
          webUserId,
          filmId,
          resolution: preferred,
        }
      );

      // =================================
      // STREAM DIRECTLY
      // Kada mu saka 500MB cikin RAM
      // =================================

      const stream =
        Readable.fromWeb(
          videoResponse.body
        );

      stream.on(
        "error",
        (error) => {
          console.error(
            "âŒ DOWNLOAD STREAM ERROR:",
            error
          );

          if (!res.headersSent) {
            res.sendStatus(500);
          } else {
            res.destroy(error);
          }
        }
      );

      stream.pipe(res);
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
// ADMIN - PREPARE BUNNY UPLOAD
// ======================================================

app.post(
  "/api/admin/bunny/prepare-upload",
  async (req, res) => {
    try {
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

      const libraryId =
        process.env.BUNNY_STREAM_LIBRARY_ID;

      const apiKey =
        process.env.BUNNY_STREAM_API_KEY;

      if (!libraryId || !apiKey) {
        return res.status(500).json({
          success: false,
          message:
            "Bunny config bai cika ba.",
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

      let bunnyVideoId =
        film.bunnyVideoId;

      // =================================
      // CREATE VIDEO IF NEEDED
      // =================================

      if (!bunnyVideoId) {
        const bunnyResponse =
          await fetch(
            `https://video.bunnycdn.com/library/${libraryId}/videos`,
            {
              method: "POST",

              headers: {
                AccessKey: apiKey,
                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify({
                title: film.title,
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
            "âŒ BUNNY CREATE VIDEO ERROR:",
            bunnyData
          );

          return res.status(502).json({
            success: false,
            message:
              "An kasa Æ™irÆ™irar Bunny video.",
          });
        }

        bunnyVideoId =
          bunnyData.guid;

        const webVideoUrl =
          `https://player.mediadelivery.net/embed/` +
          `${libraryId}/` +
          `${bunnyVideoId}`;

        await prisma.film.update({
          where: {
            id: filmId,
          },

          data: {
            bunnyVideoId,
            webVideoUrl,
          },
        });
      }

      // =================================
      // TUS SIGNATURE
      // =================================

      const expirationTime =
        Math.floor(Date.now() / 1000) +
        6 * 60 * 60;

      const signatureString =
        `${libraryId}` +
        `${apiKey}` +
        `${expirationTime}` +
        `${bunnyVideoId}`;

      const signature =
        crypto
          .createHash("sha256")
          .update(signatureString)
          .digest("hex");

      console.log(
        "âœ… BUNNY UPLOAD PREPARED:",
        {
          filmId,
          bunnyVideoId,
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
            bunnyVideoId,

          authorizationSignature:
            signature,

          authorizationExpire:
            String(expirationTime),
        },
      });
    } catch (error) {
      console.error(
        "âŒ PREPARE BUNNY UPLOAD ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "An samu matsala wajen shirya upload.",
      });
    }
  }
);
// ======================================================
// ADMIN - PREPARE BUNNY VIDEO REPLACE
// ======================================================

app.post(
  "/api/admin/bunny/prepare-replace",
  async (req, res) => {
    try {
      // =================================
      // 1. KARÆI FILM ID
      // =================================

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

      // =================================
      // 2. BUNNY CONFIG
      // =================================

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

      // =================================
      // 3. NEMO FILM A POSTGRESQL
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
            webVideoUrl: true,
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
      // 4. DOLE FILM YA RIGA YA HAÆŠU DA BUNNY
      // =================================

      if (!film.bunnyVideoId) {
        return res.status(409).json({
          success: false,
          message:
            "Wannan film bai da Bunny Video ID. Ka fara Upload to Bunny kafin Replace.",
        });
      }

      // =================================
      // 5. TABBATAR VIDEO YANA BUNNY
      // =================================

      const bunnyResponse =
        await fetch(
          `https://video.bunnycdn.com/library/${libraryId}/videos/${film.bunnyVideoId}`,
          {
            method: "GET",

            headers: {
              AccessKey: apiKey,
              Accept:
                "application/json",
            },
          }
        );

      if (!bunnyResponse.ok) {
        const errorText =
          await bunnyResponse.text();

        console.error(
          "âŒ BUNNY REPLACE CHECK ERROR:",
          bunnyResponse.status,
          errorText
        );

        return res.status(502).json({
          success: false,
          message:
            "An kasa tabbatar da existing Bunny video.",
        });
      }

      const bunnyVideo =
        await bunnyResponse.json();

      // =================================
      // 6. Æ˜IRÆ˜IRI TUS AUTH EXPIRY
      // =================================

      const expirationTime =
        Math.floor(Date.now() / 1000) +
        6 * 60 * 60;

      // =================================
      // 7. Æ˜IRÆ˜IRI BUNNY TUS SIGNATURE
      // =================================

      const signatureString =
        `${libraryId}` +
        `${apiKey}` +
        `${expirationTime}` +
        `${film.bunnyVideoId}`;

      const signature =
        crypto
          .createHash("sha256")
          .update(signatureString)
          .digest("hex");

      // =================================
      // 8. LOG
      // =================================

      console.log(
        "â™»ï¸ BUNNY REPLACE PREPARED:",
        {
          filmId: film.id,
          title: film.title,
          bunnyVideoId:
            film.bunnyVideoId,
        }
      );

      // =================================
      // 9. TURA TEMP UPLOAD INFO ZUWA FRONTEND
      // =================================

      return res.status(200).json({
        success: true,

        message:
          "Replace upload an shirya.",

        film: {
          id: film.id,
          title: film.title,

          bunnyVideoId:
            film.bunnyVideoId,
        },

        bunny: {
          currentStatus:
            bunnyVideo.status,

          currentProgress:
            bunnyVideo.encodeProgress,
        },

        upload: {
          endpoint:
            "https://video.bunnycdn.com/tusupload",

          libraryId:
            String(libraryId),

          videoId:
            film.bunnyVideoId,

          authorizationSignature:
            signature,

          authorizationExpire:
            String(expirationTime),
        },
      });
    } catch (error) {
      console.error(
        "âŒ PREPARE BUNNY REPLACE ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "An samu matsala wajen shirya Replace Video.",
      });
    }
  }
);
// ======================================================
// ADMIN - GET BUNNY VIDEO STATUS
// ======================================================

app.get(
  "/api/admin/bunny/status/:filmId",
  async (req, res) => {
    try {
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

      // =================================
      // FIND FILM
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
            webVideoUrl: true,
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
      // NOT CONNECTED
      // =================================

      if (!film.bunnyVideoId) {
        return res.status(200).json({
          success: true,

          film: {
            id: film.id,
            title: film.title,
          },

          bunny: {
            connected: false,
            statusCode: null,
            status: "not_connected",
            label: "Not Connected",
            progress: 0,
            playable: false,
            ready: false,
            failed: false,
            resolutions: [],
          },
        });
      }

      // =================================
      // CONFIG
      // =================================

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

      // =================================
      // GET VIDEO FROM BUNNY
      // =================================

      const bunnyResponse =
        await fetch(
          `https://video.bunnycdn.com/library/${libraryId}/videos/${film.bunnyVideoId}`,
          {
            method: "GET",

            headers: {
              AccessKey: apiKey,
              Accept:
                "application/json",
            },
          }
        );

      if (!bunnyResponse.ok) {
        const errorText =
          await bunnyResponse.text();

        console.error(
          "âŒ BUNNY STATUS API ERROR:",
          bunnyResponse.status,
          errorText
        );

        return res.status(502).json({
          success: false,
          message:
            "An kasa samun Bunny video status.",
        });
      }

      const video =
        await bunnyResponse.json();

      // =================================
      // STATUS MAP
      // =================================

      const statusMap = {
        0: {
          status: "queued",
          label: "Queued",
        },

        1: {
          status: "processing",
          label: "Processing",
        },

        2: {
          status: "encoding",
          label: "Transcoding",
        },

        3: {
          status: "finished",
          label: "Ready",
        },

        4: {
          status:
            "resolution_finished",
          label: "Playable",
        },

        5: {
          status: "failed",
          label: "Failed",
        },

        6: {
          status:
            "upload_started",
          label: "Upload Started",
        },

        7: {
          status:
            "upload_finished",
          label: "Upload Finished",
        },

        8: {
          status:
            "upload_failed",
          label: "Upload Failed",
        },
      };

      const statusCode =
        Number(video.status);

      const statusInfo =
        statusMap[statusCode] || {
          status: "unknown",
          label: `Status ${statusCode}`,
        };

      // =================================
      // RESOLUTIONS
      // =================================

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

      // =================================
      // FLAGS
      // =================================

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

      console.log(
        "ðŸ° BUNNY STATUS:",
        {
          filmId,
          bunnyVideoId:
            film.bunnyVideoId,
          status:
            statusInfo.label,
          progress,
        }
      );

      return res.status(200).json({
        success: true,

        film: {
          id: film.id,
          title: film.title,
        },

        bunny: {
          connected: true,

          videoId:
            film.bunnyVideoId,

          statusCode,

          status:
            statusInfo.status,

          label:
            statusInfo.label,

          progress,

          playable,

          ready,

          failed,

          resolutions,

          hasMP4Fallback:
            Boolean(
              video.hasMP4Fallback
            ),

          hasOriginal:
            Boolean(
              video.hasOriginal
            ),

          length:
            Number(
              video.length || 0
            ),

          width:
            Number(
              video.width || 0
            ),

          height:
            Number(
              video.height || 0
            ),
        },
      });
    } catch (error) {
      console.error(
        "âŒ ADMIN BUNNY STATUS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "An samu matsala wajen duba Bunny status.",
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

<div class="card">

<div class="icon">
âœ…
</div>

<h1>
Payment Successful
</h1>

<p>
An karÉ“i biyan kuÉ—inka cikin nasara.
Ka koma Telegram domin karÉ“ar film É—inka.
</p>

<a href="https://t.me/Nigfilm_bot">
BuÉ—e NIGFILM BOT
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

app.post(
  "/paystack/webhook",
  async (req, res) => {
    try {
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
          "âŒ Missing Paystack signature, raw body or secret key"
        );

        return res.sendStatus(400);
      }

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
          "âŒ Invalid Paystack signature"
        );

        return res.sendStatus(401);
      }

      const event =
        req.body;

      if (
        event?.event !==
        "charge.success"
      ) {
        return res.sendStatus(200);
      }

      const reference =
        String(
          event?.data?.reference ||
            ""
        );

      const metadata =
        event?.data?.metadata ||
        {};

      if (!reference) {
        console.log(
          "âŒ Payment reference is missing"
        );

        return res.sendStatus(200);
      }

      console.log(
        "âœ… Paystack payment received:",
        reference
      );

      // ==================================================
      // WEB APP PAYMENT
      // ==================================================

      const webOrder =
        await prisma.webOrder.findUnique({
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

            paidAmount:
              Number(
                event?.data?.amount
              ),
          });

        if (!result.success) {
          console.error(
            "âŒ WEB PAYMENT PROCESS FAILED:",
            result.message
          );

          return res.sendStatus(400);
        }

        console.log(
          "âœ… WEB PAYMENT PROCESSED:",
          reference
        );

        return res.sendStatus(200);
      }

      // ==================================================
      // TELEGRAM PAYMENT
      // ==================================================

      const order =
        await prisma.order.findUnique({
          where: {
            paymentReference:
              reference,
          },
        });

      if (!order) {
        console.log(
          "âŒ Telegram/Web Order not found:",
          reference
        );

        return res.sendStatus(200);
      }

      const paidAmount =
        Number(
          event?.data?.amount
        );

      const expectedAmount =
        Number(
          order.amount
        ) * 100;

      if (
        !Number.isFinite(
          paidAmount
        ) ||
        paidAmount !==
          expectedAmount
      ) {
        console.log(
          "âŒ Payment amount mismatch:",
          {
            reference,
            paidAmount,
            expectedAmount,
          }
        );

        return res.sendStatus(400);
      }

      if (
        order.status ===
        "paid"
      ) {
        console.log(
          "â„¹ï¸ Order already processed:",
          reference
        );

        return res.sendStatus(200);
      }

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

      try {
        await bot.telegram.sendMessage(
          order.telegramId,

          "âœ… An tabbatar da biyan kuÉ—inka cikin nasara.\n\nNa gode da amfani da NIGFILM BOT â¤ï¸"
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
        "âœ… TELEGRAM PAYMENT PROCESSED:",
        reference
      );

      return res.sendStatus(200);
    } catch (error) {
      console.error(
        "âŒ PAYSTACK WEBHOOK ERROR:",
        error
      );

      return res.sendStatus(500);
    }
  }
);

// ======================================================
// PROCESS WEB FILM PAYMENT
// ======================================================

async function processWebFilmPayment({
  reference,
  paidAmount,
}) {
  try {
    const order =
      await prisma.webOrder.findUnique({
        where: {
          paymentReference:
            reference,
        },
      });

    if (!order) {
      return {
        success: false,
        message:
          "Ba a samu WebOrder É—in payment ba.",
      };
    }

    const expectedAmount =
      Number(order.amount) * 100;

    if (
      !Number.isFinite(
        paidAmount
      ) ||
      paidAmount !==
        expectedAmount
    ) {
      console.error(
        "âŒ WEB PAYMENT AMOUNT MISMATCH:",
        {
          reference,
          paidAmount,
          expectedAmount,
        }
      );

      return {
        success: false,
        message:
          "Adadin kuÉ—in da aka biya bai dace da farashin film ba.",
      };
    }

    if (
      order.status ===
      "paid"
    ) {
      return {
        success: true,
        alreadyProcessed: true,
      };
    }

    const film =
      await prisma.film.findUnique({
        where: {
          id: order.filmId,
        },
      });

    if (!film) {
      return {
        success: false,
        message:
          "Ba a samu film É—in order ba.",
      };
    }

    await prisma.$transaction(
      async (tx) => {
        const currentOrder =
          await tx.webOrder.findUnique({
            where: {
              id: order.id,
            },
          });

        if (
          !currentOrder ||
          currentOrder.status ===
            "paid"
        ) {
          return;
        }

        const existingPurchase =
          await tx.webPurchase.findUnique({
            where: {
              webUserId_filmId: {
                webUserId:
                  order.webUserId,

                filmId:
                  order.filmId,
              },
            },
          });

        if (!existingPurchase) {
          await tx.webPurchase.create({
            data: {
              webUserId:
                order.webUserId,

              filmId:
                order.filmId,

              orderId:
                order.id,
            },
          });
        }

        await tx.webOrder.update({
          where: {
            id: order.id,
          },

          data: {
            status: "paid",
          },
        });
      }
    );

    console.log(
      "âœ… WEB PURCHASE CREATED:",
      {
        webUserId:
          order.webUserId,

        filmId:
          order.filmId,

        reference,
      }
    );

    return {
      success: true,
    };
  } catch (error) {
    console.error(
      "âŒ PROCESS WEB PAYMENT ERROR:",
      error
    );

    return {
      success: false,
      message:
        "An samu matsala wajen adana WebPurchase.",
    };
  }
}

// ======================================================
// VERIFY PAYSTACK TRANSACTION
// ======================================================

async function verifyPaystackTransaction(
  reference
) {
  try {
    if (
      !process.env
        .PAYSTACK_SECRET_KEY
    ) {
      return {
        success: false,
        message:
          "PAYSTACK_SECRET_KEY babu.",
      };
    }

    const response =
      await fetch(
        `https://api.paystack.co/transaction/verify/${encodeURIComponent(
          reference
        )}`,
        {
          method: "GET",

          headers: {
            Authorization:
              `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          },
        }
      );

    const data =
      await response.json();

    if (
      !response.ok ||
      !data?.status ||
      data?.data?.status !==
        "success"
    ) {
      console.error(
        "âŒ PAYSTACK VERIFY FAILED:",
        data
      );

      return {
        success: false,

        message:
          data?.message ||
          "Payment bai samu tabbaci ba.",
      };
    }

    if (
      String(
        data.data.reference
      ) !==
      String(reference)
    ) {
      return {
        success: false,
        message:
          "Payment reference bai dace ba.",
      };
    }

    return {
      success: true,

      amount:
        Number(
          data.data.amount
        ),

      data:
        data.data,
    };
  } catch (error) {
    console.error(
      "âŒ VERIFY PAYSTACK ERROR:",
      error
    );

    return {
      success: false,
      message:
        "An kasa tabbatar da payment daga Paystack.",
    };
  }
}

// ======================================================
// PROCESS SINGLE TELEGRAM FILM PAYMENT
// ======================================================

async function processSingleFilmPayment({
  order,
}) {
  const film =
    await prisma.film.findUnique({
      where: {
        id: order.filmId,
      },
    });

  if (!film) {
    throw new Error(
      `Film not found: ${order.filmId}`
    );
  }

  await prisma.$transaction(
    async (tx) => {
      const currentOrder =
        await tx.order.findUnique({
          where: {
            id: order.id,
          },
        });

      if (
        !currentOrder ||
        currentOrder.status ===
          "paid"
      ) {
        return;
      }

      const existingPurchase =
        await tx.purchase.findFirst({
          where: {
            telegramId:
              order.telegramId,

            filmId:
              film.id,
          },
        });

      if (!existingPurchase) {
        await tx.purchase.create({
          data: {
            telegramId:
              order.telegramId,

            filmId:
              film.id,

            orderId:
              order.id,
          },
        });
      }

      await tx.order.update({
        where: {
          id: order.id,
        },

        data: {
          status: "paid",
        },
      });
    }
  );

  try {
    await bot.telegram.sendVideo(
      order.telegramId,
      film.videoFileId,
      {
        caption:
          `ðŸŽ‰ PAYMENT CONFIRMED\n\n` +
          `ðŸŽ¬ ${film.title}\n\n` +
          "Na gode da siyan film.\n" +
          "Ga film É—inka, ka ji daÉ—in kallo.",
      }
    );
  } catch (
    deliveryError
  ) {
    console.error(
      "SINGLE FILM DELIVERY ERROR:",
      deliveryError
    );

    await bot.telegram
      .sendMessage(
        order.telegramId,

        "âš ï¸ An tabbatar da payment amma tura video ta samu matsala.\n\nKa shiga My Movies domin sake sauke film É—in."
      )
      .catch(() => {});
  }
}

// ======================================================
// PROCESS TELEGRAM CART PAYMENT
// ======================================================

async function processCartPayment({
  order,
  metadata,
}) {
  let filmIds = [];

  if (
    order.cartFilmIds
  ) {
    try {
      const parsedFilmIds =
        JSON.parse(
          order.cartFilmIds
        );

      if (
        Array.isArray(
          parsedFilmIds
        )
      ) {
        filmIds =
          parsedFilmIds
            .map(Number)
            .filter(
              Number.isInteger
            );
      }
    } catch (error) {
      console.error(
        "INVALID ORDER CART FILM IDS:",
        error
      );
    }
  }

  if (
    filmIds.length ===
      0 &&
    Array.isArray(
      metadata?.filmIds
    )
  ) {
    filmIds =
      metadata.filmIds
        .map(Number)
        .filter(
          Number.isInteger
        );
  }

  if (
    filmIds.length ===
      0 &&
    typeof metadata?.filmIds ===
      "string"
  ) {
    try {
      const parsedMetadataIds =
        JSON.parse(
          metadata.filmIds
        );

      if (
        Array.isArray(
          parsedMetadataIds
        )
      ) {
        filmIds =
          parsedMetadataIds
            .map(Number)
            .filter(
              Number.isInteger
            );
      }
    } catch {
      filmIds =
        metadata.filmIds
          .split(",")
          .map(Number)
          .filter(
            Number.isInteger
          );
    }
  }

  filmIds = [
    ...new Set(filmIds),
  ];

  if (
    filmIds.length === 0
  ) {
    throw new Error(
      `Babu film IDs a cart order ${order.id}`
    );
  }

  const films =
    await prisma.film.findMany({
      where: {
        id: {
          in: filmIds,
        },
      },
    });

  if (
    films.length === 0
  ) {
    throw new Error(
      `Ba a samu cart films na order ${order.id}`
    );
  }

  await prisma.$transaction(
    async (tx) => {
      const currentOrder =
        await tx.order.findUnique({
          where: {
            id: order.id,
          },
        });

      if (
        !currentOrder ||
        currentOrder.status ===
          "paid"
      ) {
        return;
      }

      for (
        const film of films
      ) {
        const existingPurchase =
          await tx.purchase.findFirst({
            where: {
              telegramId:
                order.telegramId,

              filmId:
                film.id,
            },
          });

        if (
          !existingPurchase
        ) {
          await tx.purchase.create({
            data: {
              telegramId:
                order.telegramId,

              filmId:
                film.id,

              orderId:
                order.id,
            },
          });
        }
      }

      await tx.cart.deleteMany({
        where: {
          telegramId:
            order.telegramId,

          filmId: {
            in: filmIds,
          },
        },
      });

      await tx.order.update({
        where: {
          id: order.id,
        },

        data: {
          status: "paid",
        },
      });
    }
  );

  for (
    const film of films
  ) {
    try {
      await bot.telegram.sendVideo(
        order.telegramId,
        film.videoFileId,
        {
          caption:
            `ðŸŽ‰ PAYMENT CONFIRMED\n\n` +
            `ðŸŽ¬ ${film.title}\n\n` +
            "Ga film É—inka, ka ji daÉ—in kallo.",
        }
      );

      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            500
          )
      );
    } catch (
      deliveryError
    ) {
      console.error(
        `CART DELIVERY ERROR â€” FILM ${film.id}:`,
        deliveryError
      );
    }
  }
}
// =================================
// WEB SESSION HELPERS
// =================================

function createSessionToken() {
  return crypto
    .randomBytes(48)
    .toString("hex");
}

function hashSessionToken(token) {
  return crypto
    .createHash("sha256")
    .update(String(token))
    .digest("hex");
}

async function createWebSession(webUserId) {
  const token =
    createSessionToken();

  const tokenHash =
    hashSessionToken(token);

  const expiresAt =
    new Date(
      Date.now() +
        7 * 24 * 60 * 60 * 1000
    );

  await prisma.webSession.create({
    data: {
      webUserId,
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
// WEB AUTH HELPERS
// ======================================================

function normalizePhone(
  value
) {
  return String(
    value || ""
  )
    .trim()
    .replace(/\s+/g, "")
    .replace(/-/g, "");
}

function hashPassword(
  password
) {
  const salt =
    crypto
      .randomBytes(16)
      .toString("hex");

  const hash =
    crypto
      .scryptSync(
        password,
        salt,
        64
      )
      .toString("hex");

  return `${salt}:${hash}`;
}

function verifyPassword(
  password,
  passwordHash
) {
  try {
    const [
      salt,
      savedHash,
    ] =
      String(
        passwordHash || ""
      ).split(":");

    if (
      !salt ||
      !savedHash
    ) {
      return false;
    }

    const generatedHash =
      crypto.scryptSync(
        password,
        salt,
        64
      );

    const savedHashBuffer =
      Buffer.from(
        savedHash,
        "hex"
      );

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

// ======================================================
// PAYSTACK HASH COMPARISON
// ======================================================

function securelyCompareHashes(
  firstHash,
  secondHash
) {
  try {
    const firstBuffer =
      Buffer.from(
        firstHash,
        "hex"
      );

    const secondBuffer =
      Buffer.from(
        secondHash,
        "hex"
      );

    if (
      firstBuffer.length !==
      secondBuffer.length
    ) {
      return false;
    }

    return crypto.timingSafeEqual(
      firstBuffer,
      secondBuffer
    );
  } catch {
    return false;
  }
}

// ======================================================
// WEB PAYMENT HTML
// ======================================================

function buildWebPaymentPage({
  success,
  title,
  message,
}) {
  const icon =
    success ? "âœ…" : "âŒ";

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

<a href="${escapeHtml(WEB_APP_URL)}">
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
        await bot.telegram.setWebhook(
          TELEGRAM_WEBHOOK_URL
        );

        console.log(
          "âœ… Telegram Webhook an saita:",
          TELEGRAM_WEBHOOK_URL
        );
      } catch (error) {
        console.error(
          "âŒ SET TELEGRAM WEBHOOK ERROR:",
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
