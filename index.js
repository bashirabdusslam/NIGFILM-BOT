import express from "express";
import crypto from "crypto";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf.toString();
    },
  })
);
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
import { Markup } from "telegraf";
import { bot, prisma, ADMIN_ID, CHANNEL_ID } from "./bot.js";

// =================================
// ADMIN MENU
// =================================

const adminMenu = Markup.inlineKeyboard([
  [
    Markup.button.callback("🎬 Add Film", "admin_add_film"),
    Markup.button.callback("🎞️ Manage Films", "admin_manage_films"),
  ],
  [
  Markup.button.callback("📊 Sales", "admin_sales"),
  Markup.button.callback("👥 Users", "admin_users"),
],
[
  Markup.button.callback(
    "📢 Broadcast",
    "admin_broadcast"
  ),
],
  [
    Markup.button.callback("⚙️ Settings", "admin_settings"),
  ],
]);

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

// =================================
// SEARCH USER
// =================================

bot.action("search_user", async (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_ID)) {
    return ctx.answerCbQuery("⛔ Ba ka da izini.");
  }

  await ctx.answerCbQuery();

  await prisma.adminSession.upsert({
    where: {
      telegramId: String(ctx.from.id),
    },
    update: {
      step: "search_user",
      filmData: "{}",
    },
    create: {
      telegramId: String(ctx.from.id),
      step: "search_user",
      filmData: "{}",
    },
  });

  return ctx.reply(
    "🔍 Aika Telegram ID na user.\n\nMisali:\n7356306160"
  );
});
// =================================
// MY MOVIES
// =================================

async function showMyMovies(ctx) {
  const telegramId = String(ctx.from.id);

  const purchases = await prisma.purchase.findMany({
    where: {
      telegramId,
    },
    include: {
      film: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (purchases.length === 0) {
    return ctx.reply(
      "📂 Har yanzu ba ka sayi wani fim ba."
    );
  }

  const buttons = purchases.map((purchase) => [
    Markup.button.callback(
      `🎬 ${purchase.film.title}`,
      `watch_${purchase.film.id}`
    ),
  ]);

  return ctx.reply(
    "🎬 *MY MOVIES*\n\nZaɓi fim ɗin da kake son sake saukewa.",
    {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard(buttons),
    }
  );
}

bot.command("mymovies", showMyMovies);

bot.hears("🎬 My Movies", showMyMovies);
// =================================
// BROWSE MOVIES
// =================================

bot.hears("🎥 Browse Movies", async (ctx) => {
  const films = await prisma.film.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });

  if (films.length === 0) {
    return ctx.reply(
      "❌ Har yanzu babu fim da aka ɗora."
    );
  }

  await ctx.reply(
    `🎬 An samu fina-finai ${films.length}.\n\nZaɓi fim daga ƙasa.`
  );
for (const film of films) {

  if (!film.posterFileId) {
    console.log(`Film ${film.id} bashi da poster`);
    continue;
  }

  await ctx.replyWithPhoto(film.posterFileId, {
      caption:
        `🎬 *${film.title}*\n\n` +
        `📝 ${film.description}\n\n` +
        `📂 Category: ${film.category}\n` +
        `💰 Price: ₦${Number(film.price).toLocaleString()}`,
      parse_mode: "Markdown",
      reply_markup: Markup.inlineKeyboard([
        [
          Markup.button.callback(
            "💳 BUY NOW",
            `buy_now_${film.id}`
          ),
        ],
      ]).reply_markup,
    });
  }
});
// =================================
// FILM DETAILS
// =================================

bot.action(/^film_manage_(\d+)$/, async (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_ID)) {
    return ctx.answerCbQuery("⛔ Ba ka da izini.");
  }

  await ctx.answerCbQuery();

  const filmId = Number(ctx.match[1]);

  const film = await prisma.film.findUnique({
    where: {
      id: filmId,
    },
  });

  if (!film) {
    return ctx.reply("❌ Film bai samu ba.");
  }

  await ctx.replyWithPhoto(film.posterFileId, {
    caption:
      `🎬 *${film.title}*\n\n` +
      `📝 ${film.description}\n\n` +
      `📂 Category: ${film.category}\n` +
      `💰 Price: ₦${Number(film.price).toLocaleString()}`,
    parse_mode: "Markdown",
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback(
          "✏ Edit Title",
          `edit_title_${film.id}`
        ),
        Markup.button.callback(
          "💰 Edit Price",
          `edit_price_${film.id}`
        ),
      ],
      [
        Markup.button.callback(
          "📝 Edit Description",
          `edit_description_${film.id}`
        ),
      ],
      [
        Markup.button.callback(
          "📂 Edit Category",
          `edit_category_${film.id}`
        ),
      ],
      [
        Markup.button.callback(
          "🖼 Change Poster",
          `change_poster_${film.id}`
        ),
        Markup.button.callback(
          "🎥 Change Video",
          `change_video_${film.id}`
        ),
      ],
      [
        Markup.button.callback(
          "🗑 Delete Film",
          `delete_film_${film.id}`
        ),
      ],
    ]),
  });
});
// =================================
// TEXT HANDLER
// =================================

bot.on("text", async (ctx) => {
  const telegramId = String(ctx.from.id).trim();

  if (telegramId !== String(ADMIN_ID)) {
    return;
  }
const session = await prisma.adminSession.findUnique({
  where: {
    telegramId: telegramId,
  },
});

if (!session) {
  return;
}

const step = session.step;
let filmData = {};

try {
  filmData = JSON.parse(session.filmData || "{}");
} catch {
  filmData = {};
}
// =================================
// USER LIST
// =================================

bot.action("user_list", async (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_ID)) {
    return ctx.answerCbQuery("⛔ Ba ka da izini.");
  }

  await ctx.answerCbQuery();

  const users = await prisma.user.findMany({
    orderBy: {
      createdAt: "desc",
    },
    take: 20,
  });

  if (users.length === 0) {
    return ctx.reply("❌ Babu users.");
  }

  let message = "👥 *USER LIST*\n\n";

  users.forEach((user, index) => {
    message +=
      `${index + 1}. ${user.firstName || "N/A"}\n` +
      `🆔 ${user.telegramId}\n\n`;
  });

  return ctx.reply(message, {
    parse_mode: "Markdown",
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback(
          "➡️ Next",
          "user_list_page_2"
        ),
      ],
      [
        Markup.button.callback(
          "⬅️ Back",
          "admin_users"
        ),
      ],
    ]),
  });
});
// =================================
// BROADCAST
// =================================

bot.action("admin_broadcast", async (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_ID)) {
    return ctx.answerCbQuery("⛔ Ba ka da izini.");
  }

  await ctx.answerCbQuery();

  await prisma.adminSession.upsert({
    where: {
      telegramId: String(ctx.from.id),
    },
    update: {
      step: "broadcast",
      filmData: "{}",
    },
    create: {
      telegramId: String(ctx.from.id),
      step: "broadcast",
      filmData: "{}",
    },
  });

  return ctx.reply(
    "📢 Aika saƙon da kake son turawa ga duk users."
  );
});
// =================================
// SAVE NEW DESCRIPTION
// =================================

if (step === "edit_description") {
  const newDescription = ctx.message.text.trim();

  if (!newDescription) {
    return ctx.reply(
      "❌ Aika sabon description na film."
    );
  }

  await prisma.film.update({
    where: {
      id: filmData.filmId,
    },
    data: {
      description: newDescription,
    },
  });

  await prisma.adminSession.delete({
    where: {
      telegramId,
    },
  });

  return ctx.reply(
    "✅ An canza description na film cikin nasara."
  );
}
// =================================
// SAVE NEW CATEGORY
// =================================

if (step === "edit_category") {
  const newCategory = ctx.message.text.trim();

  if (!newCategory) {
    return ctx.reply(
      "❌ Aika sabon category."
    );
  }

  await prisma.film.update({
    where: {
      id: filmData.filmId,
    },
    data: {
      category: newCategory,
    },
  });

  await prisma.adminSession.delete({
    where: {
      telegramId,
    },
  });

  return ctx.reply(
    `✅ An canza category zuwa:\n\n📂 ${newCategory}`
  );
}
// =================================
// SAVE NEW PRICE
// =================================

if (step === "edit_price") {
  const newPrice = Number(ctx.message.text);

  if (!Number.isFinite(newPrice) || newPrice < 0) {
    return ctx.reply(
      "❌ Farashi ba daidai ba ne.\n\nAika number kawai."
    );
  }

  await prisma.film.update({
    where: {
      id: filmData.filmId,
    },
    data: {
      price: newPrice,
    },
  });

  await prisma.adminSession.delete({
    where: {
      telegramId,
    },
  });

  return ctx.reply(
    `✅ An canza farashin film zuwa ₦${newPrice.toLocaleString()}`
  );
}
// =================================
// UPDATE FILM PRICE
// =================================

if (step === "change_price") {
  const newPrice = Number(ctx.message.text);

  if (!Number.isFinite(newPrice) || newPrice <= 0) {
    return ctx.reply(
      "❌ Farashin ba daidai ba ne.\n\nAika number kawai.\nMisali: 1000"
    );
  }

  await prisma.film.update({
    where: {
      id: filmData.filmId,
    },
    data: {
      price: newPrice,
    },
  });

  await prisma.adminSession.delete({
    where: {
      telegramId,
    },
  });

  return ctx.reply(
    `✅ An canza farashin film zuwa ₦${newPrice.toLocaleString()} cikin nasara.`
  );
}
// =================================
// SAVE NEW TITLE
// =================================

if (step === "edit_title") {

  await prisma.film.update({
    where: {
      id: filmData.filmId,
    },
    data: {
      title: ctx.message.text,
    },
  });

  await prisma.adminSession.delete({
    where: {
      telegramId,
    },
  });

  return ctx.reply(
    "✅ Sunan film ya canza cikin nasara."
  );
}
  if (step === "title") {
    filmData.title = ctx.message.text;
await prisma.adminSession.update({
  where: {
    telegramId: telegramId,
  },
  data: {
    step: "description",
    filmData: JSON.stringify(filmData),
  },
});

    return ctx.reply(
      "✅ An adana sunan film.\n\n" +
      "Mataki na 2/6\n\n" +
      "📝 Aika description na film ɗin:"
    );
  }
if (step === "description") {
  filmData.description = ctx.message.text;

  await prisma.adminSession.update({
    where: {
      telegramId: telegramId,
    },
    data: {
      step: "price",
      filmData: JSON.stringify(filmData),
    },
  });

  return ctx.reply(
    "✅ An adana description.\n\n" +
    "Mataki na 3/6\n\n" +
    "💰 Aika farashin film ɗin.\n\n" +
    "Misali: 500"
  );
}

if (step === "price") {
  const price = Number(ctx.message.text);

  if (!Number.isFinite(price) || price < 0) {
    return ctx.reply(
      "❌ Farashin ba daidai ba ne.\n\n" +
      "Aika number kawai, misali: 500"
    );
  }

  filmData.price = price;

  await prisma.adminSession.update({
    where: {
      telegramId: telegramId,
    },
    data: {
      step: "category",
      filmData: JSON.stringify(filmData),
    },
  });

  return ctx.reply(
    "✅ An adana farashi.\n\n" +
    "Mataki na 4/6\n\n" +
    "📂 Aika category na film ɗin.\n\n" +
    "Misali: Hausa Film"
  );
}
  if (step === "category") {
    filmData.category = ctx.message.text;

    await prisma.adminSession.update({
  where: {
    telegramId: telegramId,
  },
  data: {
    step: "poster",
    filmData: JSON.stringify(filmData),
  },
});
    return ctx.reply(
      "✅ An adana category.\n\n" +
      "Mataki na 5/6\n\n" +
      "🖼️ Yanzu aika POSTER ɗin film ɗin."
    );
  }
});
// =================================
// POSTER HANDLER
// =================================
  bot.on("photo", async (ctx) => {
  const telegramId = String(ctx.from.id).trim();

  if (telegramId !== String(ADMIN_ID)) return;

  const session = await prisma.adminSession.findUnique({
    where: { telegramId },
  });

if (!session) {
  return;
}

  if (session.step !== "poster" && session.step !== "change_poster") {
  return;
}
  

  let filmData = {};

  try {
    filmData = JSON.parse(session.filmData || "{}");
  } catch {
    filmData = {};
  }
const photos = ctx.message.photo;
const poster = photos[photos.length - 1];

// CHANGE POSTER
if (session.step === "change_poster") {
  await prisma.film.update({
    where: {
      id: filmData.filmId,
    },
    data: {
      posterFileId: poster.file_id,
    },
  });

  await prisma.adminSession.delete({
    where: {
      telegramId,
    },
  });

  return ctx.reply(
    "✅ An canza poster na film cikin nasara."
  );
}

// ADD NEW FILM
filmData.posterFileId = poster.file_id;

await prisma.adminSession.update({
  where: {
    telegramId,
  },
  data: {
    step: "video",
    filmData: JSON.stringify(filmData),
  },
});

return ctx.reply(
  "✅ An karɓi poster ɗin film.\n\n" +
  "Mataki na 6/6\n\n" +
  "🎥 Yanzu aika VIDEO ɗin film ɗin."
);
});
// =================================
// VIDEO HANDLER
// =================================
bot.on("video", async (ctx) => {
  const telegramId = String(ctx.from.id).trim();

  if (telegramId !== String(ADMIN_ID)) return;

  const session = await prisma.adminSession.findUnique({
    where: { telegramId },
  });

  if (!session) return;

  if (session.step !== "video" && session.step !== "change_video") {
  return;
}

  let filmData = {};

  try {
    filmData = JSON.parse(session.filmData || "{}");
  } catch {
    filmData = {};
  }

  // Adana video
  filmData.videoFileId = ctx.message.video.file_id;
// =================================
// CHANGE VIDEO
// =================================

if (session.step === "change_video") {
  await prisma.film.update({
    where: {
      id: filmData.filmId,
    },
    data: {
      videoFileId: ctx.message.video.file_id,
    },
  });

  await prisma.adminSession.delete({
    where: {
      telegramId,
    },
  });

  return ctx.reply(
    "✅ An canza VIDEO na film cikin nasara."
  );
}
  console.log("FILM DATA:", filmData);

  // Tabbatar poster yana nan
  if (!filmData.posterFileId) {
    return ctx.reply(
      "❌ Ba a samu Poster ba.\n\nSake fara Add Film."
    );
  }

  const film = await prisma.film.create({
    data: {
      title: filmData.title,
      description: filmData.description,
      category: filmData.category,
      price: Number(filmData.price),
      posterFileId: filmData.posterFileId,
      videoFileId: filmData.videoFileId,
    },
  });

  await prisma.adminSession.delete({
    where: {
      telegramId,
    },
  });

  await ctx.reply(
    "✅ FILM AN ADANA CIKIN NASARA! 🎬\n\n" +
      "🎬 Suna: " +
      film.title +
      "\n" +
      "💰 Farashi: ₦" +
      film.price +
      "\n" +
      "📂 Category: " +
      film.category +
      "\n\n" +
      "📢 Danna ƙasa domin tura shi zuwa Channel:",
    Markup.inlineKeyboard([
      [
        Markup.button.callback(
          "📢 Publish zuwa Channel",
          `admin_publish_film_${film.id}`
        ),
      ],
    ])
  );
});

// ===============================
// TELEGRAM WEBHOOK
// ===============================

app.use(express.json());

const TELEGRAM_WEBHOOK_URL =
  "https://nigfilm-bot.onrender.com/telegram-webhook";

app.post("/telegram-webhook", async (req, res) => {
  try {
    await bot.handleUpdate(req.body);
    res.sendStatus(200);
  } catch (error) {
    console.error("❌ Telegram Webhook Error:", error);
    res.sendStatus(500);
  }
});

// ===============================
// HEALTH CHECK
// ===============================

app.get("/", (req, res) => {
  res.send("✅ NIGFILM BOT API yana aiki!");
});
bot.command("getchannelid", async (ctx) => {
  try {
    const chat = await ctx.telegram.getChat("@Nigfilm_channel");

    console.log("CHANNEL ID:", chat.id);

    await ctx.reply(
      `✅ Channel ID:\n\n${chat.id}`
    );
  } catch (error) {
    console.error("❌ Get Channel ID Error:", error);
    await ctx.reply(
      "❌ An samu matsala. Ka tabbatar bot ɗin Admin ne a channel."
    );
  }
});
// ===============================
// PAYSTACK WEBHOOK
// ===============================
app.post("/paystack/webhook", async (req, res) => {
  try {
    const signature = req.headers["x-paystack-signature"];

    const hash = crypto
      .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
      .update(req.rawBody)
      .digest("hex");

    if (hash !== signature) {
      console.log("❌ Invalid Paystack Signature");
      return res.sendStatus(401);
    }

    const event = req.body;

    if (event.event !== "charge.success") {
      return res.sendStatus(200);
    }

    const reference = event.data.reference;
    const metadata = event.data.metadata || {};

    console.log("✅ Payment:", reference);

    const order = await prisma.order.findUnique({
      where: {
        paymentReference: reference,
      },
    });

    if (!order) {
      console.log("❌ Order not found:", reference);
      return res.sendStatus(200);
    }

    if (order.status === "paid") {
      return res.sendStatus(200);
    }

    await prisma.order.update({
      where: {
        id: order.id,
      },
      data: {
        status: "paid",
      },
    });

    // ===================================
    // CART CHECKOUT
    // ===================================
    if (metadata.type === "cart_checkout") {

      const cartItems = await prisma.cart.findMany({
        where: {
          telegramId: order.telegramId,
        },
        include: {
          film: true,
        },
      });

      for (const item of cartItems) {

        const exists = await prisma.purchase.findFirst({
          where: {
            telegramId: order.telegramId,
            filmId: item.filmId,
          },
        });

        if (!exists) {
          await prisma.purchase.create({
            data: {
              telegramId: order.telegramId,
              filmId: item.filmId,
              orderId: order.id,
            },
          });
        }

        await bot.telegram.sendVideo(
          Number(order.telegramId),
          item.film.videoFileId,
          {
            caption:
              `🎉 PAYMENT CONFIRMED\n\n` +
              `🎬 ${item.film.title}\n\n` +
              `Ga fim ɗinka, ka ji daɗin kallo.`
          }
        );
      }

      await prisma.cart.deleteMany({
        where: {
          telegramId: order.telegramId,
        },
      });

    } else {

      // ===================================
      // BUY NOW
      // ===================================

      const film = await prisma.film.findUnique({
        where: {
          id: order.filmId,
        },
      });

      if (film) {

        const exists = await prisma.purchase.findFirst({
          where: {
            telegramId: order.telegramId,
            filmId: film.id,
          },
        });

        if (!exists) {
          await prisma.purchase.create({
            data: {
              telegramId: order.telegramId,
              filmId: film.id,
              orderId: order.id,
            },
          });
        }

        await bot.telegram.sendVideo(
          Number(order.telegramId),
          film.videoFileId,
          {
            caption:
              `🎉 PAYMENT CONFIRMED\n\n` +
              `🎬 ${film.title}\n\n` +
              `Na gode da siyan fim.\n` +
              `Ga fim ɗinka, ka ji daɗin kallo.`
          }
        );
      }
    }

    await bot.telegram.sendMessage(
      Number(order.telegramId),
      "✅ An tabbatar da biyan kuɗinka cikin nasara. Na gode da amfani da NIGFILM BOT ❤️"
    );

    console.log("✅ Payment processed successfully");

    return res.sendStatus(200);

  } catch (err) {
    console.error("WEBHOOK ERROR:", err);
    return res.sendStatus(500);
  }
});
// ===============================
// START SERVER
// ===============================

app.listen(PORT, async () => {
  console.log(`🌐 Webhook server yana aiki a port ${PORT}`);

  try {
    await bot.telegram.setWebhook(TELEGRAM_WEBHOOK_URL);

    console.log(
      "✅ Telegram Webhook an saita:",
      TELEGRAM_WEBHOOK_URL
    );
  } catch (error) {
    console.error(
      "❌ Telegram Webhook Error:",
      error
    );
  }
});

console.log("🤖 NIGFILM BOT started successfully.");

// ===============================
// GRACEFUL SHUTDOWN
// ===============================

process.once("SIGINT", async () => {
  await prisma.$disconnect();
  bot.stop("SIGINT");
});
// =================================
// WATCH PURCHASED MOVIE
// =================================

bot.action(/^watch_(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery();

  const filmId = Number(ctx.match[1]);
  const telegramId = String(ctx.from.id);

  const purchase = await prisma.purchase.findFirst({
    where: {
      telegramId,
      filmId,
    },
    include: {
      film: true,
    },
  });

  if (!purchase) {
    return ctx.reply("❌ Ba ka mallaki wannan fim ba.");
  }

  await ctx.replyWithVideo(
    purchase.film.videoFileId,
    {
      caption:
        `🎬 ${purchase.film.title}\n\n` +
        `✅ Ga fim ɗinka. Ka ji daɗin kallo.`
    }
  );
});
process.once("SIGTERM", async () => {
  await prisma.$disconnect();
  bot.stop("SIGTERM");
});