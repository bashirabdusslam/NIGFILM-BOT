import express from "express";
import crypto from "crypto";
import { Markup } from "telegraf";

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

// =================================
// EXPRESS APP
// =================================

const app = express();

const PORT = process.env.PORT || 3000;

const TELEGRAM_WEBHOOK_URL =
  process.env.TELEGRAM_WEBHOOK_URL ||
  "https://nigfilm-bot.onrender.com/telegram-webhook";

// =================================
// EXPRESS JSON + RAW BODY
// =================================

app.use(
  express.json({
    verify: (req, res, buffer) => {
      req.rawBody = buffer;
    },
  })
);

// =================================
// SIMPLE CORS FOR WEB APP
// =================================

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");

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

// =================================
// ADMIN MENU
// =================================

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

// =================================
// REGISTER TELEGRAM HANDLERS
// =================================

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

// ======================================================
// NIGFILM WEB APP API
// ======================================================

// =================================
// GET ALL FILMS
// =================================

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
      "❌ GET FILMS API ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "An samu matsala wajen ɗauko fina-finai.",
    });
  }
});

// =================================
// GET SINGLE FILM
// =================================

app.get("/api/films/:id", async (req, res) => {
  try {
    const filmId = Number(req.params.id);

    if (
      !Number.isInteger(filmId) ||
      filmId <= 0
    ) {
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
      "❌ GET SINGLE FILM API ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "An samu matsala wajen ɗauko film.",
    });
  }
});

// =================================
// GET FILM CATEGORIES
// =================================

app.get("/api/categories", async (req, res) => {
  try {
    const films = await prisma.film.findMany({
      select: {
        category: true,
      },
    });

    const categories = [
      ...new Set(
        films
          .map((film) => film.category)
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
      "❌ GET CATEGORIES API ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "An samu matsala wajen ɗauko categories.",
    });
  }
});

// =================================
// SEARCH FILMS
// =================================

app.get("/api/search", async (req, res) => {
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

    const films = await prisma.film.findMany({
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
      "❌ SEARCH FILMS API ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "An samu matsala wajen neman film.",
    });
  }
});

// =================================
// FILM POSTER PROXY
// =================================
//
// Wannan yana ba Web App damar nuna poster
// ba tare da bayyana Telegram BOT_TOKEN ba.
//

app.get(
  "/api/films/:id/poster",
  async (req, res) => {
    try {
      const filmId = Number(req.params.id);

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

      const response = await fetch(
        fileLink.href
      );

      if (!response.ok) {
        console.error(
          "❌ TELEGRAM POSTER FETCH FAILED:",
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
        "❌ POSTER API ERROR:",
        error
      );

      return res.sendStatus(500);
    }
  }
);

// ======================================================
// TELEGRAM WEBHOOK
// ======================================================

app.post(
  "/telegram-webhook",
  async (req, res) => {
    try {
      await bot.handleUpdate(req.body);

      return res.sendStatus(200);
    } catch (error) {
      console.error(
        "❌ TELEGRAM WEBHOOK ERROR:",
        error
      );

      return res.sendStatus(500);
    }
  }
);

// =================================
// HEALTH CHECK
// =================================

app.get("/", (req, res) => {
  return res.status(200).json({
    success: true,
    service: "NIGFILM",
    message:
      "✅ NIGFILM BOT & WEB API suna aiki!",
  });
});

// =================================
// API HEALTH CHECK
// =================================

app.get("/api/health", (req, res) => {
  return res.status(200).json({
    success: true,
    service: "NIGFILM API",
    database: "PostgreSQL",
    status: "online",
  });
});

// =================================
// PAYMENT SUCCESS PAGE
// =================================

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

  <title>Payment Successful</title>

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

      background: #e50914;

      color: white;

      text-decoration: none;

      font-weight: bold;
    }
  </style>
</head>

<body>
  <div class="card">

    <div class="icon">
      ✅
    </div>

    <h1>
      Payment Successful
    </h1>

    <p>
      An karɓi biyan kuɗinka cikin nasara.
      Idan ka saya ta Telegram,
      ka koma bot domin karɓar film ɗinka.
    </p>

    <a
      href="https://t.me/Nigfilm_bot"
    >
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

app.post(
  "/paystack/webhook",
  async (req, res) => {
    try {
      const signature =
        req.headers[
          "x-paystack-signature"
        ];

      if (
        typeof signature !== "string" ||
        !req.rawBody ||
        !process.env.PAYSTACK_SECRET_KEY
      ) {
        console.log(
          "❌ Missing Paystack signature, raw body or secret key"
        );

        return res.sendStatus(400);
      }

      const calculatedHash = crypto
        .createHmac(
          "sha512",
          process.env.PAYSTACK_SECRET_KEY
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

      const event = req.body;

      if (
        event?.event !==
        "charge.success"
      ) {
        return res.sendStatus(200);
      }

      const reference =
        event?.data?.reference;

      const metadata =
        event?.data?.metadata || {};

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

      const order =
        await prisma.order.findUnique({
          where: {
            paymentReference:
              reference,
          },
        });

      if (!order) {
        console.log(
          "❌ Order not found:",
          reference
        );

        return res.sendStatus(200);
      }

      // Paystack amount yana cikin KOBO
      const paidAmount = Number(
        event?.data?.amount
      );

      const expectedAmount =
        Number(order.amount) * 100;

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

      if (
        order.status === "paid"
      ) {
        console.log(
          "ℹ️ Order already processed:",
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
          "✅ An tabbatar da biyan kuɗinka cikin nasara.\n\nNa gode da amfani da NIGFILM BOT ❤️"
        );
      } catch (messageError) {
        console.error(
          "PAYMENT CONFIRMATION MESSAGE ERROR:",
          messageError
        );
      }

      console.log(
        "✅ Payment processed successfully:",
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

// =================================
// PROCESS SINGLE FILM PAYMENT
// =================================

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
        currentOrder.status === "paid"
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
          `🎉 PAYMENT CONFIRMED\n\n` +
          `🎬 ${film.title}\n\n` +
          "Na gode da siyan film.\n" +
          "Ga film ɗinka, ka ji daɗin kallo.",
      }
    );
  } catch (deliveryError) {
    console.error(
      "SINGLE FILM DELIVERY ERROR:",
      deliveryError
    );

    await bot.telegram
      .sendMessage(
        order.telegramId,
        "⚠️ An tabbatar da payment amma tura video ta samu matsala.\n\nKa shiga My Movies domin sake sauke film ɗin."
      )
      .catch(() => {});
  }
}

// =================================
// PROCESS CART PAYMENT
// =================================

async function processCartPayment({
  order,
  metadata,
}) {
  let filmIds = [];

  // =================================
  // FILM IDS FROM ORDER DATABASE
  // =================================

  if (order.cartFilmIds) {
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

  // =================================
  // FALLBACK — PAYSTACK METADATA ARRAY
  // =================================

  if (
    filmIds.length === 0 &&
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

  // =================================
  // FALLBACK — PAYSTACK JSON STRING
  // =================================

  if (
    filmIds.length === 0 &&
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

  // Remove duplicates
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
        currentOrder.status === "paid"
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

  // =================================
  // DELIVER FILMS
  // =================================

  for (
    const film of films
  ) {
    try {
      await bot.telegram.sendVideo(
        order.telegramId,
        film.videoFileId,
        {
          caption:
            `🎉 PAYMENT CONFIRMED\n\n` +
            `🎬 ${film.title}\n\n` +
            "Ga film ɗinka, ka ji daɗin kallo.",
        }
      );

      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            500
          )
      );
    } catch (deliveryError) {
      console.error(
        `CART DELIVERY ERROR — FILM ${film.id}:`,
        deliveryError
      );
    }
  }
}

// =================================
// SECURE HASH COMPARISON
// =================================

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

// =================================
// START SERVER
// =================================

const server = app.listen(
  PORT,
  async () => {
    console.log(
      `🌐 NIGFILM server yana aiki a port ${PORT}`
    );

    try {
      await bot.telegram.setWebhook(
        TELEGRAM_WEBHOOK_URL
      );

      console.log(
        "✅ Telegram Webhook an saita:",
        TELEGRAM_WEBHOOK_URL
      );
    } catch (error) {
      console.error(
        "❌ SET TELEGRAM WEBHOOK ERROR:",
        error
      );
    }
  }
);

console.log(
  "🤖 NIGFILM BOT & WEB API started successfully."
);

// =================================
// GRACEFUL SHUTDOWN
// =================================

let isShuttingDown = false;

async function gracefulShutdown(
  signal
) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  console.log(
    `🛑 Ana rufe server saboda ${signal}...`
  );

  server.close(async () => {
    try {
      await prisma.$disconnect();

      console.log(
        "✅ Prisma da server sun rufe lafiya."
      );

      process.exit(0);
    } catch (error) {
      console.error(
        "❌ SHUTDOWN ERROR:",
        error
      );

      process.exit(1);
    }
  });

  setTimeout(() => {
    console.error(
      "❌ Graceful shutdown timeout."
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