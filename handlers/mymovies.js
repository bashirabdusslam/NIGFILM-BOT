import { bot, prisma } from "../bot.js";
import { Markup } from "telegraf";

const MOVIES_PER_PAGE = 10;

export default function registerMyMoviesHandlers() {
  // =================================
// MY MOVIES — CALLBACK
// =================================

bot.action("my_purchases", async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});

  return showMyMovies(ctx, 1);
});

  // =================================
  // MY MOVIES — COMMAND
  // =================================

  bot.command("mymovies", async (ctx) => {
    return showMyMovies(ctx, 1);
  });

  // =================================
  // MY MOVIES — OLD REPLY KEYBOARD
  // =================================

  bot.hears("🎬 My Movies", async (ctx) => {
    return showMyMovies(ctx, 1);
  });

  // =================================
  // MY MOVIES — PAGINATION
  // =================================

  bot.action(/^my_movies_page_(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});

    const page = Number(ctx.match[1]);

    return showMyMovies(ctx, page);
  });

  // =================================
  // WATCH / DOWNLOAD PURCHASED FILM
  // =================================

  bot.action(/^watch_(\d+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery().catch(() => {});

      const telegramId = String(ctx.from.id);
      const filmId = Number(ctx.match[1]);

      if (!Number.isInteger(filmId)) {
        return ctx.reply("❌ Film ID bai dace ba.");
      }

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

      if (!purchase.film.videoFileId) {
        return ctx.reply(
          "❌ Ba a samu video na wannan film ba."
        );
      }

      await bot.telegram.sendVideo(
        ctx.chat.id,
        purchase.film.videoFileId,
        {
          caption:
            `🎬 ${purchase.film.title}\n\n` +
            "✅ Wannan film yana cikin My Movies ɗinka.",
        }
      );

      return;
    } catch (error) {
      console.error("WATCH MOVIE ERROR:", error);

      return ctx.reply(
        "❌ An samu kuskure wajen tura film."
      );
    }
  });

  // =================================
  // DOWNLOAD ALIAS
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

      return bot.telegram.sendVideo(
        ctx.chat.id,
        purchase.film.videoFileId,
        {
          caption: `🎬 ${purchase.film.title}`,
        }
      );
    } catch (error) {
      console.error("DOWNLOAD MOVIE ERROR:", error);

      return ctx.reply(
        "❌ An samu kuskure wajen tura film."
      );
    }
  });
}

// =================================
// SHOW MY MOVIES
// =================================

async function showMyMovies(ctx, requestedPage) {
  try {
    const telegramId = String(ctx.from.id);

    const totalMovies = await prisma.purchase.count({
      where: {
        telegramId,
      },
    });

    if (totalMovies === 0) {
      return ctx.reply(
        "📂 Har yanzu ba ka sayi wani film ba.",
        {
          ...Markup.inlineKeyboard([
            [
              Markup.button.callback(
                "🎬 Browse Films",
                "browse_films"
              ),
            ],
            [
              Markup.button.callback(
                "🏠 Main Menu",
                "main_menu"
              ),
            ],
          ]),
        }
      );
    }

    const totalPages = Math.max(
      1,
      Math.ceil(totalMovies / MOVIES_PER_PAGE)
    );

    const page = Math.min(
      Math.max(Number(requestedPage) || 1, 1),
      totalPages
    );

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
      skip: (page - 1) * MOVIES_PER_PAGE,
      take: MOVIES_PER_PAGE,
    });

    const buttons = purchases.map((purchase) => [
      Markup.button.callback(
        `🎬 ${shortenText(
          purchase.film.title,
          40
        )}`,
        `watch_${purchase.film.id}`
      ),
    ]);

    const navigation = [];

    if (page > 1) {
      navigation.push(
        Markup.button.callback(
          "⬅️ Previous",
          `my_movies_page_${page - 1}`
        )
      );
    }

    if (page < totalPages) {
      navigation.push(
        Markup.button.callback(
          "Next ➡️",
          `my_movies_page_${page + 1}`
        )
      );
    }

    if (navigation.length > 0) {
      buttons.push(navigation);
    }

    buttons.push([
      Markup.button.callback(
        "🎬 Browse Films",
        "browse_films"
      ),
    ]);

    buttons.push([
      Markup.button.callback(
        "🏠 Main Menu",
        "main_menu"
      ),
    ]);

    return ctx.reply(
      `🎬 *MY MOVIES*

📄 Page: ${page}/${totalPages}

🎥 Total Movies: ${totalMovies}

Zaɓi film ɗin da kake son kallo ko sake saukewa:`,
      {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      }
    );
  } catch (error) {
    console.error("MY MOVIES ERROR:", error);

    return ctx.reply(
      "❌ An samu kuskure wajen ɗauko fina-finanka."
    );
  }
}

// =================================
// HELPER
// =================================

function shortenText(value, maximumLength) {
  const text = String(value || "");

  if (text.length <= maximumLength) {
    return text;
  }

  return `${text.slice(0, maximumLength - 3)}...`;
}