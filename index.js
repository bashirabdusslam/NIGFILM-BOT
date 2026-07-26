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
import {
  initDatabase,
  getDatabase,
  saveDatabase,
} from "./database.js";

const bot = new Telegraf(process.env.BOT_TOKEN);

const ADMIN_ID = process.env.ADMIN_ID;
const CHANNEL_ID = process.env.CHANNEL_ID;

await initDatabase();

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

  // Mutum ya zo daga Channel ta hanyar BUY NOW
  if (payload && payload.startsWith("film_")) {
    const filmId = Number(payload.replace("film_", ""));

    const db = getDatabase();

    const result = db.exec(
      `SELECT * FROM films WHERE id = ${filmId}`
    );

    if (!result.length || !result[0].values.length) {
      return ctx.reply(
        "❌ Ba a samu wannan film ɗin ba."
      );
    }

    const film = result[0].values[0];

    const id = film[0];
    const title = film[1];
    const price = film[2];

    return ctx.reply(
      `🎬 Film: ${title}\n\n` +
      `💰 Farashi: ₦${price}\n\n` +
      `👇 Danna ƙasa domin ci gaba da siya:`,
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            "💳 BUY NOW",
            `buy_now_${id}`
          )
        ]
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

  await ctx.answerCbQuery();

  const db = getDatabase();

  db.run(
    "INSERT OR REPLACE INTO admin_sessions " +
      "(telegram_id, step, film_data) VALUES (?, ?, ?)",
    [
      String(ctx.from.id),
      "title",
      JSON.stringify({}),
    ]
  );

  saveDatabase();

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
  const telegramId = String(ctx.from.id);

  if (telegramId !== String(ADMIN_ID)) {
    return;
  }

  const db = getDatabase();

  const result = db.exec(
    "SELECT * FROM admin_sessions WHERE telegram_id = '" +
      telegramId +
      "'"
  );

  if (
    !result.length ||
    !result[0].values.length
  ) {
    return;
  }

  const session = result[0].values[0];

  const step = session[1];
  const filmData = JSON.parse(session[2] || "{}");

  if (step === "title") {
    filmData.title = ctx.message.text;

    db.run(
      "UPDATE admin_sessions SET step = ?, film_data = ? " +
        "WHERE telegram_id = ?",
      [
        "description",
        JSON.stringify(filmData),
        telegramId,
      ]
    );

    saveDatabase();

    return ctx.reply(
      "✅ An adana sunan film.\n\n" +
      "Mataki na 2/6\n\n" +
      "📝 Aika description na film ɗin:"
    );
  }

  if (step === "description") {
    filmData.description = ctx.message.text;

    db.run(
      "UPDATE admin_sessions SET step = ?, film_data = ? " +
        "WHERE telegram_id = ?",
      [
        "price",
        JSON.stringify(filmData),
        telegramId,
      ]
    );

    saveDatabase();

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

    db.run(
      "UPDATE admin_sessions SET step = ?, film_data = ? " +
        "WHERE telegram_id = ?",
      [
        "category",
        JSON.stringify(filmData),
        telegramId,
      ]
    );

    saveDatabase();

    return ctx.reply(
      "✅ An adana farashi.\n\n" +
      "Mataki na 4/6\n\n" +
      "📂 Aika category na film ɗin.\n\n" +
      "Misali: Hausa Film"
    );
  }

  if (step === "category") {
    filmData.category = ctx.message.text;

    db.run(
      "UPDATE admin_sessions SET step = ?, film_data = ? " +
        "WHERE telegram_id = ?",
      [
        "poster",
        JSON.stringify(filmData),
        telegramId,
      ]
    );

    saveDatabase();

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
  const telegramId = String(ctx.from.id);

  if (telegramId !== String(ADMIN_ID)) {
    return;
  }

  const db = getDatabase();

  const result = db.exec(
    "SELECT * FROM admin_sessions WHERE telegram_id = '" +
      telegramId +
      "'"
  );

  if (
    !result.length ||
    !result[0].values.length
  ) {
    return;
  }

  const session = result[0].values[0];

  if (session[1] !== "poster") {
    return;
  }

  const filmData = JSON.parse(session[2] || "{}");

  const photos = ctx.message.photo;
  const poster = photos[photos.length - 1];

  filmData.poster_file_id = poster.file_id;

  db.run(
    "UPDATE admin_sessions SET step = ?, film_data = ? " +
      "WHERE telegram_id = ?",
    [
      "video",
      JSON.stringify(filmData),
      telegramId,
    ]
  );

  saveDatabase();

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
  const telegramId = String(ctx.from.id);

  if (telegramId !== String(ADMIN_ID)) {
    return;
  }

  const db = getDatabase();

  const result = db.exec(
    "SELECT * FROM admin_sessions WHERE telegram_id = '" +
      telegramId +
      "'"
  );

  if (
    !result.length ||
    !result[0].values.length
  ) {
    return;
  }

  const session = result[0].values[0];

  if (session[1] !== "video") {
    return;
  }

  const filmData = JSON.parse(session[2] || "{}");

  filmData.video_file_id = ctx.message.video.file_id;

  db.run(
    "INSERT INTO films " +
      "(title, description, category, price, poster_file_id, video_file_id) " +
      "VALUES (?, ?, ?, ?, ?, ?)",
    [
      filmData.title,
      filmData.description,
      filmData.category,
      filmData.price,
      filmData.poster_file_id,
      filmData.video_file_id,
    ]
  );

  db.run(
    "DELETE FROM admin_sessions WHERE telegram_id = ?",
    [telegramId]
  );

  saveDatabase();

  await ctx.reply(
    "✅ FILM AN ADANA CIKIN NASARA! 🎬\n\n" +
    "🎬 Suna: " +
    filmData.title +
    "\n" +
    "💰 Farashi: ₦" +
    filmData.price +
    "\n" +
    "📂 Category: " +
    filmData.category +
    "\n\n" +
    "📢 Danna ƙasa domin tura shi zuwa Channel:",
    Markup.inlineKeyboard([
      [
        Markup.button.callback(
          "📢 Publish zuwa Channel",
          "admin_publish_film"
        ),
      ],
    ])
  );
});

// =================================
// PUBLISH FILM TO CHANNEL
// =================================

bot.action("admin_publish_film", async (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_ID)) {
    return ctx.answerCbQuery("⛔ Ba ka da izini.");
  }

  ctx.answerCbQuery().catch(() => {});

  const db = getDatabase();

  const result = db.exec(
    "SELECT * FROM films ORDER BY id DESC LIMIT 1"
  );

  if (
    !result.length ||
    !result[0].values.length
  ) {
    return ctx.reply(
      "❌ Babu film da aka adana tukuna."
    );
  }

  const film = result[0].values[0];
  
  const filmId = film [0];
  const title = film[1];
  const description = film[2];
  const category = film[3];
  const price = film[4];
  const posterFileId = film[5];
  const videoFileId = film[6];
  const caption =
    "🎬 " +
    title +
    "\n\n" +
    "📝 " +
    description +
    "\n\n" +
    "📂 Category: " +
    category +
    "\n" +
    "💰 Price: ₦" +
    price +
    "\n\n" +
    "👇 Zaɓi abin da kake so:";

  await bot.telegram.sendVideo(
  CHANNEL_ID,
  videoFileId,
  {
    caption: caption,

    ...Markup.inlineKeyboard([
      [
        Markup.button.url(
          "💳 BUY NOW",
          `https://t.me/El_bash_movie_bot?start=film_${filmId}`
        )
      ]
    ])
  }
);

  await ctx.reply(
    "✅ An tura " +
      title +
      " zuwa Channel cikin nasara! 🎬"
  );
});
// ===============================
// BUY NOW - BILLSTACK
// ===============================

bot.action(/^buy_now_(\d+)$/, async (ctx) => {
  try {
    await ctx.answerCbQuery().catch(() => {});

    const filmId = Number(ctx.match[1]);
    const telegramId = String(ctx.from.id);

    const db = getDatabase();

    // Find film
    const filmResult = db.exec(
      `SELECT * FROM films WHERE id = ${filmId} LIMIT 1`
    );

    if (!filmResult.length || !filmResult[0].values.length) {
      return ctx.reply("❌ Ba a sami wannan film ba.");
    }

    const film = filmResult[0].values[0];

    const title = film[1];
    const price = Number(film[4]);

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
    db.run(
      `INSERT INTO orders
      (telegram_id, film_id, amount, status, payment_reference)
      VALUES (?, ?, ?, ?, ?)`,
      [
        telegramId,
        filmId,
        price,
        "pending",
        orderReference,
      ]
    );

    saveDatabase();

    // BillStack API
    const response = await fetch(
      "https://api.billstack.co/v2/thirdparty/generateVirtualAccount/",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.BILLSTACK_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reference: orderReference,
          email,
          phone: "08000000000",
          firstName,
          lastName,
          bank: "9PSB",
        }),
      }
    );

    const result = await response.json();

    if (!response.ok || !result.status) {
      console.error("BillStack Error:", result);

      return ctx.reply(
        "❌ An samu matsala wajen ƙirƙirar payment account.\n\n" +
        "Da fatan sake gwadawa."
      );
    }

    const account = result.data.account[0];

    const virtualAccountReference = result.data.reference;
    const accountNumber = account.account_number;
    const accountName = account.account_name;
    const bankName = account.bank_name;

    // Get order ID
    const orderResult = db.exec(
      `SELECT id FROM orders
       WHERE payment_reference = '${orderReference}'
       ORDER BY id DESC
       LIMIT 1`
    );

    if (orderResult.length && orderResult[0].values.length) {
      const orderId = orderResult[0].values[0][0];

      db.run(
        `UPDATE orders
         SET virtual_account_reference = ?,
             account_number = ?,
             account_name = ?,
             bank_name = ?
         WHERE id = ?`,
        [
          virtualAccountReference,
          accountNumber,
          accountName,
          bankName,
          orderId,
        ]
      );

      saveDatabase();
    }

    await ctx.reply(
      `💳 *PAYMENT DETAILS*\n\n` +
      `🎬 Film: ${title}\n` +
      `💰 Amount: ₦${price.toLocaleString()}\n\n` +
      `🏦 Bank: ${bankName}\n` +
      `💳 Account Number: \`${accountNumber}\`\n` +
      `👤 Account Name: ${accountName}\n\n` +
      `⚠️ Tura ₦${price.toLocaleString()} kawai zuwa wannan account.\n\n` +
      `✅ Bayan an tabbatar da payment, za a tura maka film ɗin ta atomatik.`,
      {
        parse_mode: "Markdown",
      }
    );

  } catch (error) {
    console.error("Buy Now Error:", error);

    await ctx.reply(
      "❌ An samu matsala. Da fatan sake gwadawa."
    );
  }
});
// =================================
// START BOT
// =================================
app.post("/webhooks/billstack", async (req, res) => {
  try {
    const timestamp = req.headers["x-wiaxy-timestamp"];
    const signature = req.headers["x-wiaxy-signature-256"];
    const rawBody = req.rawBody;

    if (!timestamp || !signature || !rawBody) {
      return res.status(401).json({
        status: false,
        message: "Missing webhook signature",
      });
    }

    // Replay protection: 5 minutes
    if (
      Math.abs(Date.now() / 1000 - Number(timestamp)) > 300
    ) {
      return res.status(401).json({
        status: false,
        message: "Expired webhook",
      });
    }

    const expectedSignature = crypto
      .createHmac(
        "sha256",
        process.env.BILLSTACK_API_KEY
      )
      .update(`${timestamp}.${rawBody}`)
      .digest("hex");

    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );

    if (!isValid) {
      return res.status(401).json({
        status: false,
        message: "Invalid signature",
      });
    }

    // Amsa BillStack da wuri
    res.status(200).json({
      status: true,
      message: "successful",
    });

    const payment = req.body;

    console.log(
      "💰 BILLSTACK PAYMENT RECEIVED:",
      JSON.stringify(payment, null, 2)
    );

    if (
      payment.event !== "PAYMENT_NOTIFICATION" ||
      payment.data?.type !== "RESERVED_ACCOUNT_TRANSACTION"
    ) {
      return;
    }

    const reference =
      payment.data.reference ||
      payment.data.merchant_reference;

    const amount = Number(payment.data.amount);

    const db = getDatabase();

    const result = db.exec(
      `SELECT * FROM orders
       WHERE virtual_account_reference = '${reference}'
       AND status = 'pending'
       LIMIT 1`
    );

    if (!result.length || !result[0].values.length) {
      console.log("❌ Order not found:", reference);
      return;
    }

    const order = result[0].values[0];

    const orderId = order[0];
    const telegramId = order[1];
    const filmId = order[2];
    const orderAmount = order[3];

    if (amount < Number(orderAmount)) {
      console.log("❌ Payment amount is insufficient");
      return;
    }

    db.run(
      `UPDATE orders
       SET status = 'paid'
       WHERE id = ?`,
      [orderId]
    );

    db.run(
      `INSERT INTO purchases
       (telegram_id, film_id, order_id)
       VALUES (?, ?, ?)`,
      [telegramId, filmId, orderId]
    );

    const filmResult = db.exec(
      `SELECT * FROM films WHERE id = ${filmId}`
    );

    if (!filmResult.length || !filmResult[0].values.length) {
      console.log("❌ Film not found");
      saveDatabase();
      return;
    }

    const film = filmResult[0].values[0];

const title = film[1];
const videoFileId = film[6];

    saveDatabase();

    if (videoFileId) {
      await bot.telegram.sendVideo(
        telegramId,
        videoFileId,
        {
          caption:
            `✅ PAYMENT CONFIRMED! 🎉\n\n` +
            `🎬 Film: ${title}\n\n` +
            `📥 Ga film ɗinka a ƙasa 👇`,
        }
      );
    }

    console.log(
      `✅ Payment confirmed and film sent to ${telegramId}`
    );
  } catch (error) {
    console.error("❌ Webhook Error:", error);
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

console.log("🤖 NIGFILM BOT yana aiki...");

// ===============================
// GRACEFUL SHUTDOWN
// ===============================

process.once(
  "SIGINT",
  () => bot.stop("SIGINT")
);

process.once(
  "SIGTERM",
  () => bot.stop("SIGTERM")
);
