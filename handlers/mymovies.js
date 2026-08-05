import { bot, prisma } from "../bot.js";
import { Markup } from "telegraf";

const MOVIES_PER_PAGE = 10;

export default function registerMyMoviesHandlers() {
  // =================================
  // MY MOVIES CALLBACK
  // =================================

  bot.action("my_purchases", async (ctx) => {
    try {
      await ctx.answerCbQuery().catch(() => {});

      return showMyMovies(ctx, 1);
    } catch (error) {
      console.error("MY PURCHASES ERROR:", error);

      return ctx.reply(
        "❌ An samu kuskure wajen buɗe My Movies."
      );
    }
  });

  // =================================
  // MY MOVIES COMMAND
  // =================================

  bot.command("mymovies", async (ctx) => {
    return showMyMovies(ctx, 1);
  });

  // =================================
  // OLD REPLY KEYBOARD SUPPORT
  // =================================

  bot.hears("🎬 My Movies", async (ctx) => {
    return showMyMovies(ctx, 1);
  });

  // =================================
  // MY MOVIES PAGINATION
  // =================================

  bot.action(
    /^my_movies_page_(\d+)$/,
    async (ctx) => {
      try {
        await ctx.answerCbQuery().catch(() => {});

        const page = Number(ctx.match[1]);

        return showMyMovies(ctx, page);
      } catch (error) {
        console.error(
          "MY MOVIES PAGE ERROR:",
          error
        );

        return ctx.reply(
          "❌ An samu kuskure wajen buɗe shafin."
        );
      }
    }
  );

  // =================================
  // WATCH PURCHASED FILM
  // =================================

  bot.action(/^watch_(\d+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery().catch(() => {});

      const telegramId = String(ctx.from.id);
      const filmId = Number(ctx.match[1]);

      if (!Number.isInteger(filmId)) {
        return ctx.reply(
          "❌ Film ID bai dace ba."
        );
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
        return ctx.reply(
          "❌ Ba ka mallaki wannan film ba."
        );
      }

      if (!purchase.film) {
        return ctx.reply(
          "❌ Ba a samu bayanan wannan film ba."
        );
      }

      if (!purchase.film.videoFileId) {
        return ctx.reply(
          "❌ Wannan film ba shi da video."
        );
      }

      return bot.telegram.sendVideo(
        ctx.chat.id,
        purchase.film.videoFileId,
        {
          caption:
            `🎬 ${purchase.film.title}\n\n` +
            "✅ Ga film ɗinka. Ka ji daɗin kallo.",
        }
      );
    } catch (error) {
      console.error("WATCH MOVIE ERROR:", error);

      return ctx.reply(
        "❌ An samu kuskure wajen tura film."
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

      if (!Number.isInteger(filmId)) {
        return ctx.reply(
          "❌ Film ID bai dace ba."
        );
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
        return ctx.reply(
          "❌ Ba ka mallaki wannan film ba."
        );
      }

      if (!purchase.film?.videoFileId) {
        return ctx.reply(
          "❌ Ba a samu video na wannan film ba."
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
      console.error(
        "DOWNLOAD MOVIE ERROR:",
        error
      );

      return ctx.reply(
        "❌ An samu kuskure wajen tura film."
      );
    }
  });
}

// =================================
// SHOW MY MOVIES
// =================================

async function showMyMovies(ctx, requestedPage = 1) {
  try {
    const telegramId = String(ctx.from.id);

    const totalMovies = await prisma.purchase.count({
      where: {
        telegramId,
      },
    });

    if (totalMovies === 0) {
      return replaceOrReply(
        ctx,
        "📂 *MY MOVIES*\n\nHar yanzu ba ka sayi wani film ba.",
        {
          parse_mode: "Markdown",
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

    const purchases =
      await prisma.purchase.findMany({
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

    const validPurchases = purchases.filter(
      (purchase) => purchase.film
    );

    if (validPurchases.length === 0) {
      return replaceOrReply(
        ctx,
        "❌ Ba a samu bayanan fina-finanka ba.",
        {
          ...Markup.inlineKeyboard([
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

    const buttons = validPurchases.map(
      (purchase) => [
        Markup.button.callback(
          `🎬 ${shortenText(
            purchase.film.title,
            40
          )}`,
          `watch_${purchase.film.id}`
        ),
      ]
    );

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

    return replaceOrReply(
      ctx,
      `🎬 *MY MOVIES*

📄 Page: ${page}/${totalPages}

🎥 Total Movies: ${totalMovies}

Zaɓi film ɗin da kake son kallo:`,
      {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      }
    );
  } catch (error) {
    console.error("SHOW MY MOVIES ERROR:", error);

    return ctx.reply(
      "❌ An samu kuskure wajen ɗauko fina-finanka."
    );
  }
}

// =================================
// EDIT MESSAGE OR REPLY
// =================================

async function replaceOrReply(
  ctx,
  message,
  options = {}
) {
  if (ctx.callbackQuery?.message) {
    try {
      return await ctx.editMessageText(
        message,
        options
      );
    } catch (error) {
      const description =
        error?.response?.description || "";

      if (
        description.includes(
          "message is not modified"
        )
      ) {
        return;
      }

      if (
        description.includes(
          "there is no text in the message to edit"
        ) ||
        description.includes(
          "message can't be edited"
        ) ||
        description.includes(
          "message to edit not found"
        )
      ) {
        await ctx.deleteMessage().catch(() => {});

        return ctx.reply(message, options);
      }

      throw error;
    }
  }

  return ctx.reply(message, options);
}

// =================================
// SHORTEN TEXT
// =================================

function shortenText(value, maximumLength) {
  const text = String(value || "");

  if (text.length <= maximumLength) {
    return text;
  }

  return `${text.slice(
    0,
    maximumLength - 3
  )}...`;
}