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
// REGISTER HANDLERS
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

// =================================
// TELEGRAM WEBHOOK
// =================================

app.post("/telegram-webhook", async (req, res) => {
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
});

// =================================
// HEALTH CHECK
// =================================

app.get("/", (req, res) => {
  return res
    .status(200)
    .send("✅ NIGFILM BOT API yana aiki!");
});

// =================================
// PAYMENT SUCCESS PAGE
// =================================

app.get("/payment-success", (req, res) => {
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
            background: #f3f4f6;
            font-family: Arial, sans-serif;
          }

          .card {
            width: 90%;
            max-width: 450px;
            padding: 32px;
            border-radius: 18px;
            background: white;
            text-align: center;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
          }

          h1 {
            color: #16a34a;
          }

          p {
            color: #374151;
            line-height: 1.6;
          }

          a {
            display: inline-block;
            margin-top: 16px;
            padding: 12px 22px;
            border-radius: 10px;
            background: #2563eb;
            color: white;
            text-decoration: none;
          }
        </style>
      </head>

      <body>
        <div class="card">
          <h1>✅ Payment Successful</h1>

          <p>
            An karɓi biyan kuɗinka.
            Ka koma Telegram domin karɓar film ɗinka.
          </p>

          <a href="https://t.me/Nigfilm_bot">
            Buɗe NIGFILM BOT
          </a>
        </div>
      </body>
    </html>
  `);
});

// =================================
// PAYSTACK WEBHOOK
// =================================

app.post("/paystack/webhook", async (req, res) => {
  try {
    const signature =
      req.headers["x-paystack-signature"];

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

    if (event?.event !== "charge.success") {
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

    const order = await prisma.order.findUnique({
      where: {
        paymentReference: reference,
      },
    });

    if (!order) {
      console.log(
        "❌ Order not found:",
        reference
      );

      return res.sendStatus(200);
    }

    // Paystack amount yana cikin kobo
    const paidAmount =
      Number(event?.data?.amount);

    const expectedAmount =
      Number(order.amount) * 100;

    if (
      !Number.isFinite(paidAmount) ||
      paidAmount !== expectedAmount
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

    if (order.status === "paid") {
      console.log(
        "ℹ️ Order already processed:",
        reference
      );

      return res.sendStatus(200);
    }

    if (metadata.type === "cart_checkout") {
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
});

// =================================
// PROCESS SINGLE FILM PAYMENT
// =================================

async function processSingleFilmPayment({
  order,
}) {
  const film = await prisma.film.findUnique({
    where: {
      id: order.filmId,
    },
  });

  if (!film) {
    throw new Error(
      `Film not found: ${order.filmId}`
    );
  }

  await prisma.$transaction(async (tx) => {
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
          telegramId: order.telegramId,
          filmId: film.id,
        },
      });

    if (!existingPurchase) {
      await tx.purchase.create({
        data: {
          telegramId: order.telegramId,
          filmId: film.id,
          orderId: order.id,
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
  });

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

    // Ko delivery ya fadi, film yana cikin My Movies.
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
  const metadataFilmIds = Array.isArray(
    metadata.filmIds
  )
    ? metadata.filmIds
        .map(Number)
        .filter(Number.isInteger)
    : [];

  let films = [];

  if (metadataFilmIds.length > 0) {
    films = await prisma.film.findMany({
      where: {
        id: {
          in: metadataFilmIds,
        },
      },
    });
  } else {
    // Fallback ga tsoffin cart payments
    const cartItems =
      await prisma.cart.findMany({
        where: {
          telegramId: order.telegramId,
        },
        include: {
          film: true,
        },
      });

    films = cartItems.map(
      (item) => item.film
    );
  }

  if (films.length === 0) {
    throw new Error(
      `No cart films found for order ${order.id}`
    );
  }

  await prisma.$transaction(async (tx) => {
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

    for (const film of films) {
      const existingPurchase =
        await tx.purchase.findFirst({
          where: {
            telegramId: order.telegramId,
            filmId: film.id,
          },
        });

      if (!existingPurchase) {
        await tx.purchase.create({
          data: {
            telegramId: order.telegramId,
            filmId: film.id,
            orderId: order.id,
          },
        });
      }
    }

    await tx.cart.deleteMany({
      where: {
        telegramId: order.telegramId,
        filmId: {
          in: films.map(
            (film) => film.id
          ),
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
  });

  for (const film of films) {
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
    } catch (deliveryError) {
      console.error(
        `CART FILM DELIVERY ERROR — FILM ${film.id}:`,
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
      Buffer.from(firstHash, "hex");

    const secondBuffer =
      Buffer.from(secondHash, "hex");

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

const server = app.listen(PORT, async () => {
  console.log(
    `🌐 Webhook server yana aiki a port ${PORT}`
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
});

console.log(
  "🤖 NIGFILM BOT started successfully."
);

// =================================
// GRACEFUL SHUTDOWN
// =================================

let isShuttingDown = false;

async function gracefulShutdown(signal) {
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

process.once("SIGINT", () => {
  gracefulShutdown("SIGINT");
});

process.once("SIGTERM", () => {
  gracefulShutdown("SIGTERM");
});