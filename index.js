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
// MANAGE FILMS
// =================================

bot.action("admin_manage_films", async (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_ID)) {
    return ctx.answerCbQuery("⛔ Ba ka da izini.");
  }

  await ctx.answerCbQuery();

  const films = await prisma.film.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });

  if (films.length === 0) {
    return ctx.reply("❌ Babu wani film a database.");
  }

  for (const film of films) {
    if (!film.posterFileId) {
  continue;
}
    await ctx.replyWithPhoto(film.posterFileId, {
      caption:
        `🎬 *${film.title}*\n\n` +
        `📂 ${film.category}\n` +
        `💰 ₦${Number(film.price).toLocaleString()}`,

      parse_mode: "Markdown",

      ...Markup.inlineKeyboard([
        [
          Markup.button.callback(
            "ℹ️ Details",
            `film_details_${film.id}`
          ),
        ],
        [
          Markup.button.callback(
            "✏️ Edit",
            `edit_film_${film.id}`
          ),
          Markup.button.callback(
            "💰 Price",
            `price_film_${film.id}`
          ),
        ],
        [
          Markup.button.callback(
            "🖼 Poster",
            `change_poster_${film.id}`
          ),
          Markup.button.callback(
            "🎥 Video",
            `change_video_${film.id}`
          ),
        ],
        [
          Markup.button.callback(
            "🗑 Delete",
            `delete_film_${film.id}`
          ),
        ],
      ]),
    });
  }
});
// =================================
// FILM DETAILS
// =================================

bot.action(/^film_details_(\d+)$/, async (ctx) => {
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
    return ctx.reply("❌ Ba a samu wannan film ba.");
  }

  return ctx.replyWithPhoto(film.posterFileId, {
    caption:
      `🎬 *${film.title}*\n\n` +
      `📝 ${film.description}\n\n` +
      `📂 Category: ${film.category}\n` +
      `💰 Price: ₦${Number(film.price).toLocaleString()}\n\n` +
      `🆔 Film ID: ${film.id}`,

    parse_mode: "Markdown",

    ...Markup.inlineKeyboard([
      [
        Markup.button.callback(
          "✏️ Edit Film",
          `edit_film_${film.id}`
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
// DELETE FILM
// =================================

bot.action(/^delete_film_(\d+)$/, async (ctx) => {
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
    return ctx.reply("❌ Ba a samu wannan film ba.");
  }

  await prisma.purchase.deleteMany({
    where: {
      filmId,
    },
  });

  await prisma.order.deleteMany({
    where: {
      filmId,
    },
  });

  await prisma.film.delete({
    where: {
      id: filmId,
    },
  });

  await ctx.editMessageCaption(
    `🗑 An goge "${film.title}" daga database cikin nasara.`
  );
});
// =================================
// CHANGE PRICE
// =================================

bot.action(/^price_film_(\d+)$/, async (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_ID)) {
    return ctx.answerCbQuery("⛔ Ba ka da izini.");
  }

  await ctx.answerCbQuery();

  const filmId = Number(ctx.match[1]);

  await prisma.adminSession.upsert({
    where: {
      telegramId: String(ctx.from.id),
    },
    update: {
      step: "change_price",
      filmData: JSON.stringify({
        filmId,
      }),
    },
    create: {
      telegramId: String(ctx.from.id),
      step: "change_price",
      filmData: JSON.stringify({
        filmId,
      }),
    },
  });

  await ctx.reply(
    "💰 Aika sabon farashin wannan film.\n\nMisali: 1000"
  );
});
// =================================
// ADMIN SALES
// =================================

bot.action("admin_sales", async (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_ID)) {
    return ctx.answerCbQuery("⛔ Ba ka da izini.");
  }

  await ctx.answerCbQuery();

  const totalUsers = await prisma.user.count();

  const totalMovies = await prisma.film.count();

  const totalOrders = await prisma.order.count({
    where: {
      status: "paid",
    },
  });

  const revenue = await prisma.order.aggregate({
    where: {
      status: "paid",
    },
    _sum: {
      amount: true,
    },
  });

  await ctx.reply(
    `📊 *NIGFILM SALES DASHBOARD*

💰 Total Revenue:
₦${Number(revenue._sum.amount || 0).toLocaleString()}

🛒 Total Sales:
${totalOrders}

👥 Total Users:
${totalUsers}

🎬 Total Movies:
${totalMovies}`,
    {
      parse_mode: "Markdown",
    }
  );
});
// =================================
// ADMIN USERS
// =================================

bot.action("admin_users", async (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_ID)) {
    return ctx.answerCbQuery("⛔ Ba ka da izini.");
  }

  await ctx.answerCbQuery();

  // Total Users
  const totalUsers = await prisma.user.count();

  // Sabbin Users na yau
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayUsers = await prisma.user.count({
    where: {
      createdAt: {
        gte: today,
      },
    },
  });

  // User na ƙarshe
  const latestUsers = await prisma.user.findMany({
    orderBy: {
      createdAt: "desc",
    },
    take: 10,
  });

  let message =
    `👥 *USERS DASHBOARD*\n\n` +
    `👤 Total Users: ${totalUsers}\n` +
    `🆕 New Users Today: ${todayUsers}\n\n` +
    `📋 Last 10 Users:\n\n`;

  latestUsers.forEach((user, index) => {
    message +=
      `${index + 1}. ${user.firstName || "No Name"} ` +
      `${user.lastName || ""}\n` +
      `🆔 ${user.telegramId}\n\n`;
  });

  await ctx.reply(message, {
    parse_mode: "Markdown",
  });
});
// =================================
// ADMIN COMMAND
// =================================

bot.command("admin", async (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_ID)) {
    return ctx.reply("⛔ Ba ka da izinin shiga Admin Panel.");
  }

  console.log("ADMIN COMMAND WORKING");

  return ctx.reply(
    "👨‍💼 ADMIN PANEL\n\nZaɓi abin da kake son yi:",
    adminMenu
  );
});
// =================================
// START
// =================================

bot.start(async (ctx) => {
  const payload = ctx.startPayload;

  // Save ko Update User
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

  // Idan user ya fito daga Channel
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

    return ctx.replyWithPhoto(film.posterFileId, {
      caption:
        `🎬 *${film.title}*\n\n` +
        `📝 ${film.description}\n\n` +
        `📂 Category: ${film.category}\n` +
        `💰 Farashi: ₦${Number(film.price).toLocaleString()}\n\n` +
        `👇 Danna BUY NOW domin ci gaba da siya.`,
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback(
            "💳 BUY NOW",
            `buy_now_${film.id}`
          ),
        ],
      ]),
    });
  }

  // =================================
  // NORMAL START
  // =================================

  return ctx.reply(
    "🎬 *Barka da zuwa NIGFILM BOT!*\n\n" +
      "🎥 Sayi fina-finai cikin sauƙi.\n\n" +
      "👇 Zaɓi abin da kake son yi:",
    {
      parse_mode: "Markdown",
      ...Markup.keyboard([
        ["🎥 Browse Movies", "🎬 My Movies"],
        ["📞 Support"],
      ]).resize(),
    }
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
// EDIT PRICE
// =================================

bot.action(/^edit_price_(\d+)$/, async (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_ID)) {
    return ctx.answerCbQuery("⛔ Ba ka da izini.");
  }

  await ctx.answerCbQuery();

  const filmId = Number(ctx.match[1]);

  await prisma.adminSession.upsert({
    where: {
      telegramId: String(ctx.from.id),
    },
    update: {
      step: "edit_price",
      filmData: JSON.stringify({
        filmId,
      }),
    },
    create: {
      telegramId: String(ctx.from.id),
      step: "edit_price",
      filmData: JSON.stringify({
        filmId,
      }),
    },
  });

  return ctx.reply(
    "💰 Aika sabon farashin film.\n\nMisali:\n500"
  );
});
// =================================
// EDIT TITLE
// =================================

bot.action(/^edit_title_(\d+)$/, async (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_ID)) {
    return ctx.answerCbQuery("⛔ Ba ka da izini.");
  }

  await ctx.answerCbQuery();

  const filmId = Number(ctx.match[1]);

  await prisma.adminSession.upsert({
    where: {
      telegramId: String(ctx.from.id),
    },
    update: {
      step: "edit_title",
      filmData: JSON.stringify({
        filmId,
      }),
    },
    create: {
      telegramId: String(ctx.from.id),
      step: "edit_title",
      filmData: JSON.stringify({
        filmId,
      }),
    },
  });

  return ctx.reply(
    "📝 Aika sabon sunan film."
  );
});
// =================================
// MANAGE FILMS
// =================================

bot.action("admin_manage_films", async (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_ID)) {
    return ctx.answerCbQuery("⛔ Ba ka da izini.");
  }

  await ctx.answerCbQuery();

  const films = await prisma.film.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });

  if (films.length === 0) {
    return ctx.reply("❌ Babu wani film.");
  }

  const buttons = films.map((film) => [
    Markup.button.callback(
      `🎬 ${film.title}`,
      `film_manage_${film.id}`
    ),
  ]);

  await ctx.reply(
    "🎞️ MANAGE FILMS\n\nZaɓi film ɗaya:",
    Markup.inlineKeyboard(buttons)
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
// =================================
// SAVE NEW TITLE
// =================================

if (step === "edit_title") {
  const newTitle = ctx.message.text.trim();

  if (!newTitle) {
    return ctx.reply(
      "❌ Aika sabon sunan film."
    );
  }

  await prisma.film.update({
    where: {
      id: filmData.filmId,
    },
    data: {
      title: newTitle,
    },
  });

  await prisma.adminSession.delete({
    where: {
      telegramId,
    },
  });

  return ctx.reply(
    `✅ An canza sunan film zuwa:\n\n🎬 ${newTitle}`
  );
}
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
// EDIT FILM MENU
// =================================

bot.action(/^edit_film_(\d+)$/, async (ctx) => {
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
    return ctx.reply("❌ Film ba a samu ba.");
  }

  return ctx.reply(
    `✏️ EDIT FILM

🎬 ${film.title}

Zaɓi abin da kake son gyarawa:`,
    Markup.inlineKeyboard([
      [
        Markup.button.callback(
          "📝 Title",
          `edit_title_${film.id}`
        ),
        Markup.button.callback(
          "📄 Description",
          `edit_description_${film.id}`
        ),
      ],
      [
        Markup.button.callback(
          "📂 Category",
          `edit_category_${film.id}`
        ),
        Markup.button.callback(
          "🖼 Poster",
          `edit_poster_${film.id}`
        ),
      ],
      [
        Markup.button.callback(
          "🎥 Video",
          `edit_video_${film.id}`
        ),
      ],
    ])
  );
});

// =================================
// EDIT TITLE
// =================================

bot.action(/^edit_title_(\d+)$/, async (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_ID)) {
    return ctx.answerCbQuery("⛔ Ba ka da izini.");
  }

  await ctx.answerCbQuery();

  const filmId = Number(ctx.match[1]);

  await prisma.adminSession.upsert({
    where: {
      telegramId: String(ctx.from.id),
    },
    update: {
      step: "edit_title",
      filmData: JSON.stringify({
        filmId,
      }),
    },
    create: {
      telegramId: String(ctx.from.id),
      step: "edit_title",
      filmData: JSON.stringify({
        filmId,
      }),
    },
  });

  return ctx.reply(
    "📝 Aika sabon sunan film."
  );
});
// =================================
// EDIT DESCRIPTION
// =================================

bot.action(/^edit_description_(\d+)$/, async (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_ID)) {
    return ctx.answerCbQuery("⛔ Ba ka da izini.");
  }

  await ctx.answerCbQuery();

  const filmId = Number(ctx.match[1]);

  await prisma.adminSession.upsert({
    where: {
      telegramId: String(ctx.from.id),
    },
    update: {
      step: "edit_description",
      filmData: JSON.stringify({
        filmId,
      }),
    },
    create: {
      telegramId: String(ctx.from.id),
      step: "edit_description",
      filmData: JSON.stringify({
        filmId,
      }),
    },
  });

  return ctx.reply(
    "📝 Aika sabon description na film."
  );
});
// =================================
// EDIT CATEGORY
// =================================

bot.action(/^edit_category_(\d+)$/, async (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_ID)) {
    return ctx.answerCbQuery("⛔ Ba ka da izini.");
  }

  await ctx.answerCbQuery();

  const filmId = Number(ctx.match[1]);

  await prisma.adminSession.upsert({
    where: {
      telegramId: String(ctx.from.id),
    },
    update: {
      step: "edit_category",
      filmData: JSON.stringify({
        filmId,
      }),
    },
    create: {
      telegramId: String(ctx.from.id),
      step: "edit_category",
      filmData: JSON.stringify({
        filmId,
      }),
    },
  });

  return ctx.reply(
    "📂 Aika sabon category na film."
  );
});
// =================================
// CHANGE POSTER
// =================================

bot.action(/^change_poster_(\d+)$/, async (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_ID)) {
    return ctx.answerCbQuery("⛔ Ba ka da izini.");
  }

  await ctx.answerCbQuery();

  const filmId = Number(ctx.match[1]);

  await prisma.adminSession.upsert({
    where: {
      telegramId: String(ctx.from.id),
    },
    update: {
      step: "change_poster",
      filmData: JSON.stringify({
        filmId,
      }),
    },
    create: {
      telegramId: String(ctx.from.id),
      step: "change_poster",
      filmData: JSON.stringify({
        filmId,
      }),
    },
  });

  return ctx.reply(
    "🖼️ Yanzu aika sabon POSTER na film."
  );
});
// =================================
// CHANGE VIDEO
// =================================

bot.action(/^change_video_(\d+)$/, async (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_ID)) {
    return ctx.answerCbQuery("⛔ Ba ka da izini.");
  }

  await ctx.answerCbQuery();

  const filmId = Number(ctx.match[1]);

  await prisma.adminSession.upsert({
    where: {
      telegramId: String(ctx.from.id),
    },
    update: {
      step: "change_video",
      filmData: JSON.stringify({
        filmId,
      }),
    },
    create: {
      telegramId: String(ctx.from.id),
      step: "change_video",
      filmData: JSON.stringify({
        filmId,
      }),
    },
  });

  return ctx.reply(
    "🎥 Yanzu aika sabon VIDEO na film."
  );
});
// =================================
// DELETE FILM
// =================================

bot.action(/^delete_film_(\d+)$/, async (ctx) => {
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
    return ctx.reply("❌ Ba a samu film ba.");
  }

  await ctx.reply(
    `⚠️ Kana tabbatar kana son goge:\n\n🎬 ${film.title}?`,
    Markup.inlineKeyboard([
      [
        Markup.button.callback(
  "🖼 Poster",
  `change_poster_${film.id}`
),
        Markup.button.callback(
  "🎥 Video",
  `change_video_${film.id}`
),
      ],
    ])
  );
});
// =================================
// CONFIRM DELETE FILM
// =================================

bot.action(/^confirm_delete_(\d+)$/, async (ctx) => {
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
    return ctx.reply("❌ Ba a samu wannan film ba.");
  }

  await prisma.film.delete({
    where: {
      id: filmId,
    },
  });

  return ctx.reply(
    `✅ Film "${film.title}" an goge cikin nasara.`
  );
});
// =================================
// CANCEL DELETE
// =================================

bot.action("cancel_delete", async (ctx) => {
  await ctx.answerCbQuery();

  return ctx.reply(
    "✅ An soke goge film."
  );
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

// =================================
// PUBLISH FILM TO CHANNEL
// =================================

bot.action(/^admin_publish_film_(\d+)$/, async (ctx) => {
  try {
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
`🎬 *${film.title}*

📝 ${film.description}

📂 Category: ${film.category}
💰 Price: ₦${Number(film.price).toLocaleString()}

━━━━━━━━━━━━━━━
🔥 Kalli wannan fim cikin inganci.

👇 Danna BUY NOW domin siya.`;

    await bot.telegram.sendPhoto(
      CHANNEL_ID,
      film.posterFileId,
      {
        caption,
        parse_mode: "Markdown",
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
      `✅ An publish "${film.title}" zuwa channel cikin nasara.`
    );

  } catch (error) {
    console.error("Publish Error:", error);

    await ctx.reply(
      "❌ An samu kuskure wajen publish film."
    );
  }
});
// ===============================
// BUY NOW - PAYSTACK
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
    const email =
  `${telegramId}@telegram.nigfilm.com`;

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
     channels: [
  "card",
  "bank",
  "bank_transfer",
  "ussd"
],
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
// =================================
// MY PURCHASES
// =================================

bot.action("my_purchases", async (ctx) => {
  try {
    await ctx.answerCbQuery().catch(() => {});

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
        "📭 Har yanzu ba ka sayi wani film ba."
      );
    }

    for (const purchase of purchases) {
      const film = purchase.film;

      await ctx.reply(
        `🎬 *${film.title}*\n\n` +
        `📂 ${film.category}\n` +
        `💰 ₦${Number(film.price).toLocaleString()}`,
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard([
            [
              Markup.button.callback(
                "📥 Download",
                `download_${film.id}`
              ),
            ],
          ]),
        }
      );
    }

  } catch (error) {
    console.error("MY PURCHASES ERROR:", error);

    await ctx.reply(
      "❌ An samu kuskure wajen ɗauko fina-finanka."
    );
  }
});
// =================================
// DOWNLOAD PURCHASED FILM
// =================================

bot.action(/^download_(\d+)$/, async (ctx) => {
  try {
    await ctx.answerCbQuery().catch(() => {});

    const telegramId = String(ctx.from.id);
    const filmId = Number(ctx.match[1]);

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
      return ctx.reply(
        "❌ Ba ka mallaki wannan film ba."
      );
    }

    await bot.telegram.sendVideo(
      ctx.chat.id,
      purchase.film.videoFileId,
      {
        caption: `🎬 ${purchase.film.title}`,
      }
    );

  } catch (error) {
    console.error("DOWNLOAD ERROR:", error);

    await ctx.reply(
      "❌ An samu kuskure wajen tura film."
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

    const film = await prisma.film.findUnique({
      where: {
        id: order.filmId,
      },
    });

    if (!film) {
      console.log("❌ Film not found");
      return res.sendStatus(200);
    }

    const purchase = await prisma.purchase.findFirst({
      where: {
        telegramId: order.telegramId,
        filmId: film.id,
      },
    });

    if (!purchase) {
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

    await bot.telegram.sendMessage(
      Number(order.telegramId),
      "✅ An gama komai cikin nasara."
    );

    console.log("✅ Film delivered");

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