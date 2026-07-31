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
import "dotenv/config";
import { Telegraf, Markup } from "telegraf";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const bot = new Telegraf(process.env.BOT_TOKEN);

const ADMIN_ID = process.env.ADMIN_ID;
const CHANNEL_ID = process.env.CHANNEL_ID;


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
    Markup.button.callback("⚙️ Settings", "admin_settings"),
  ],
]);
// =================================
// START
// =================================
bot.start(async (ctx) => {
  const payload = ctx.startPayload;
await prisma.user.upsert({
  where: {
    telegramId: String(ctx.from.id),
  },
  update: {
    firstName: ctx.from.first_name || "",
    lastName: ctx.from.last_name || "",
    username: ctx.from.username || "",
  },
  create: {
    telegramId: String(ctx.from.id),
    firstName: ctx.from.first_name || "",
    lastName: ctx.from.last_name || "",
    username: ctx.from.username || "",
  },
});
  // Mutum ya zo daga Channel ta hanyar BUY NOW
  if (payload && payload.startsWith("film_")) {
    const filmId = Number(payload.replace("film_", ""));

    const film = await prisma.film.findUnique({
      where: {
        id: filmId,
      },
    });

    if (!film) {
      return ctx.reply("❌ Ba a samu wannan film ɗin ba.");
    }

    return ctx.reply(
      `🎬 Film: ${film.title}\n\n` +
      `💰 Farashi: ₦${film.price}\n\n` +
      `👇 Danna ƙasa domin ci gaba da siya:`,

      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            "💳 BUY NOW",
            `buy_now_${film.id}`
          ),
        ],
      ])
    );
  }

  // Normal /start
  await ctx.reply(
    "🎬 Barka da zuwa NIGFILM BOT!\n\n" +
    "🎥 Siyan fina-finai\n" +
    "💳 Biyan kuɗi cikin sauƙi\n" +
    "📥 Sauke fim bayan biyan kuɗi"
  );
});

// =================================
// ADMIN PANEL
// =================================

bot.command("admin", async (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_ID)) {
    return ctx.reply("⛔ Ba ka da izinin shiga Admin Panel.");
  }

  await ctx.reply(
    "👨‍💼 ADMIN PANEL\n\n" +
    "Zaɓi abin da kake son yi:",
    adminMenu
  );
});

// =================================
// ADD FILM
// =================================

bot.action("admin_add_film", async (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_ID)) {
    return ctx.answerCbQuery("⛔ Ba ka da izini.");
  }

  await ctx.answerCbQuery().catch(() => {});
await prisma.adminSession.upsert({
  where: {
    telegramId: String(ctx.from.id),
  },
  update: {
    step: "title",
    filmData: JSON.stringify({}),
  },
  create: {
    telegramId: String(ctx.from.id),
    step: "title",
    filmData: JSON.stringify({}),
  },
});

  await ctx.reply(
    "🎬 ADD FILM\n\n" +
    "Mataki na 1/6\n\n" +
    "📝 Aika sunan film ɗin:"
  );
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

  if (!session) return;

  if (session.step !== "poster") return;

  let filmData = {};

  try {
    filmData = JSON.parse(session.filmData || "{}");
  } catch {
    filmData = {};
  }

  const photos = ctx.message.photo;
  const poster = photos[photos.length - 1];

  // ✅ Wannan shine ake nema
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

  await ctx.reply(
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

  if (session.step !== "video") return;

  let filmData = {};

  try {
    filmData = JSON.parse(session.filmData || "{}");
  } catch {
    filmData = {};
  }

  // Adana video
  filmData.videoFileId = ctx.message.video.file_id;

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
// =================================
// PUBLISH FILM TO CHANNEL
// =================================

bot.action(/^admin_publish_film_(\d+)$/, async (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_ID)) {
    return ctx.answerCbQuery("⛔ Ba ka da izini.");
  }

  await ctx.answerCbQuery().catch(() => {});

  const filmId = Number(ctx.match[1]);

  const film = await prisma.film.findUnique({
    where: {
      id: filmId,
    },
  });

  if (!film) {
    return ctx.reply("❌ Ba a samu wannan film ba.");
  }

  const caption =
    "🎬 " +
    film.title +
    "\n\n" +
    "📝 " +
    film.description +
    "\n\n" +
    "📂 Category: " +
    film.category +
    "\n" +
    "💰 Price: ₦" +
    film.price +
    "\n\n" +
    "👇 Zaɓi abin da kake so:";

  await bot.telegram.sendPhoto(
    CHANNEL_ID,
    film.posterFileId,
    {
      caption,
      ...Markup.inlineKeyboard([
        [
          Markup.button.url(
            "💳 BUY NOW",
            `https://t.me/Nigfilm_bot?start=film_${film.id}`
          ),
        ],
      ]),
    }
  );

  await ctx.reply(
    `✅ An tura "${film.title}" zuwa Channel cikin nasara! 🎬`
  );
});

// ===============================
// BUY NOW - BILLSTACK
// ===============================

bot.action(/^buy_now_(\d+)$/, async (ctx) => {
  try {
    await ctx.answerCbQuery().catch(() => {});

    const filmId = Number(ctx.match[1]);
    const telegramId = String(ctx.from.id).trim();
// Find film
const film = await prisma.film.findUnique({
  where: {
    id: filmId,
  },
});

if (!film) {
  return ctx.reply("❌ Ba a sami wannan film ba.");
}

const title = film.title;
const price = Number(film.price);

    // User information
    const firstName = ctx.from.first_name || "Customer";
    const lastName = ctx.from.last_name || "User";
    const username = ctx.from.username || "";

    // Temporary email
    const email = `${telegramId}@nigifilm.com`;

    // Create unique order reference
    const orderReference =
      `NIGIFILM_${telegramId}_${filmId}_${Date.now()}`;

    // Create order
    const order = await prisma.order.create({
  data: {
    telegramId,
    filmId,
    amount: price,
    status: "pending",
    paymentReference: orderReference,
  },
});
const response = await fetch(
  "https://api.paystack.co/transaction/initialize",
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      amount: price * 100,
      reference: orderReference,
      callback_url: "https://nigfilm-bot.onrender.com/payment-success",
      metadata: {
        telegramId,
        filmId,
      },
    }),
  }
);

const result = await response.json();

if (!result.status) {
  console.error(result);

  return ctx.reply(
    "❌ An kasa ƙirƙirar Payment Link."
  );
}

const paymentLink = result.data.authorization_url;
  await ctx.reply(
  `🎬 *${title}*

💰 Amount: ₦${price.toLocaleString()}

✅ Danna link ɗin da ke ƙasa domin biyan kuɗi ta Paystack.

🔗 ${paymentLink}

⚠️ Bayan an tabbatar da biyan kuɗinka, bot zai tura maka film ɗin ta atomatik.`,
  {
    parse_mode: "Markdown",
    disable_web_page_preview: true,
  }
);
} catch (error) {
  console.error("========== BUY NOW ERROR ==========");
  console.error(error);

  await ctx.reply(
    "❌ ERROR:\n\n" +
    (error.message || JSON.stringify(error))
  );
}
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
  const hash = crypto
  .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
  .update(req.rawBody)
  .digest("hex");

if (hash !== req.headers["x-paystack-signature"]) {
  return res.sendStatus(401);
}
  try {
    const hash = crypto
  .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
  .update(req.rawBody)
  .digest("hex");

if (hash !== req.headers["x-paystack-signature"]) {
  console.log("❌ Invalid Paystack Signature");
  return res.sendStatus(401);
}

    const event = req.body;

    if (event.event === "charge.success") {
      const reference = event.data.reference;

      // Nemo order
      const order = await prisma.order.findUnique({
        where: {
          paymentReference: reference,
        },
      });

      if (!order) {
        return res.sendStatus(200);
      }

      // Idan an riga an biya
      if (order.status === "paid") {
        return res.sendStatus(200);
      }

      // Update order
      await prisma.order.update({
        where: {
          id: order.id,
        },
        data: {
          status: "paid",
        },
      });

      // Nemo film
      const film = await prisma.film.findUnique({
        where: {
          id: order.filmId,
        },
      });

      if (film) {
        // Tura video ga customer
        await bot.telegram.sendVideo(
  Number(order.telegramId),
          film.videoFileId,
          {
            caption:
              `✅ An tabbatar da biyan kuɗinka.\n\n` +
              `🎬 ${film.title}\n\n` +
              `Ga fim ɗinka.`
          }
        );

        // Adana purchase
        await prisma.purchase.create({
          data: {
            telegramId: order.telegramId,
            filmId: film.id,
            orderId: order.id,
          },
        });
      }
    }

    res.sendStatus(200);

  } catch (error) {
    console.error("Paystack Webhook Error:", error);
    res.sendStatus(500);
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

process.once("SIGTERM", async () => {
  await prisma.$disconnect();
  bot.stop("SIGTERM");
});