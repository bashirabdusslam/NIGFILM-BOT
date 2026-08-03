import { bot, prisma, ADMIN_ID, CHANNEL_ID } from "../bot.js";
import { Markup } from "telegraf";

export default function registerFilmHandlers() {

  // Duk handlers na film za su shiga nan.



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
}