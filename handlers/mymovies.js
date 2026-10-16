import { bot, prisma } from "../bot.js";
import { Markup } from "telegraf";

const MOVIES_PER_PAGE = 10;

const PUBLIC_BASE_URL = (
  process.env.PUBLIC_BASE_URL ||
  "https://nigfilm-bot.onrender.com"
)
  .trim()
  .replace(/\/+$/, "");

export default function registerMyMoviesHandlers() {
  // =================================
  // MY MOVIES CALLBACKS
  // =================================

  bot.action(
    ["my_purchases", "my_movies"],
    async (ctx) => {
      await ctx.answerCbQuery().catch(() => {});

      return showMyMovies(ctx, 1);
    }
  );

  // =================================
  // MY MOVIES COMMAND
  // =================================

  bot.command("mymovies", (ctx) => {
    return showMyMovies(ctx, 1);
  });

  // =================================
  // REPLY KEYBOARD SUPPORT
  // =================================

  bot.hears("🎬 My Movies", (ctx) => {
    return showMyMovies(ctx, 1);
  });

  // =================================
  // PAGINATION
  // =================================

  bot.action(
    /^my_movies_page_(\d+)$/,
    async (ctx) => {
      await ctx.answerCbQuery().catch(() => {});

      return showMyMovies(
        ctx,
        Number(ctx.match[1])
      );
    }
  );

  // =================================
  // OPEN PURCHASED FILM
  // =================================

  bot.action(/^watch_(\d+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery().catch(() => {});

      const film = await getPurchasedFilm(
        ctx,
        Number(ctx.match[1])
      );

      if (!film) return;

      // =================================
      // BUNNY STREAM FILM
      // =================================

      if (film.bunnyVideoId) {
        const telegramId = String(ctx.from.id);

        const buttons = [];

        if (film.webVideoUrl) {
          buttons.push([
            Markup.button.webApp(
              "▶️ Watch Movie",
              moviePageUrl(
                "watch",
                film.id,
                telegramId
              )
            ),
          ]);
        }

        buttons.push([
          Markup.button.webApp(
            "⬇️ Download Movie",
            moviePageUrl(
              "download",
              film.id,
              telegramId
            )
          ),
        ]);

        buttons.push([
          Markup.button.callback(
            "⬅️ My Movies",
            "my_movies"
          ),
        ]);

        return await ctx.reply(
          `🎬 ${film.title}\n\n` +
            "✅ Wannan film yana cikin library ɗinka.\n\n" +
            "Zaɓi kallo ko download.\n\n" +
            "A shafin download, danna Download Movie " +
            "domin sauke fim zuwa na’urarka.",
          Markup.inlineKeyboard(buttons)
        );
      }

      // =================================
      // OLD TELEGRAM FILM
      // =================================

      if (film.videoFileId) {
        return await sendTelegramMovie(ctx, film);
      }

      return await ctx.reply(
        "❌ Wannan film bai samu video source ba tukuna."
      );
    } catch (error) {
      logError("WATCH MOVIE ERROR", error);

      return ctx.reply(
        "❌ An samu kuskure wajen buɗe film."
      );
    }
  });

  // =================================
  // DOWNLOAD PURCHASED FILM
  // Supports older download buttons.
  // =================================

  bot.action(/^download_(\d+)$/, async (ctx) => {
    try {
      await ctx
        .answerCbQuery(
          "⏳ Ana shirya film ɗinka..."
        )
        .catch(() => {});

      const film = await getPurchasedFilm(
        ctx,
        Number(ctx.match[1])
      );

      if (!film) return;

      // =================================
      // BUNNY: NATIVE DOWNLOAD MINI APP
      // =================================

      if (film.bunnyVideoId) {
        const downloadPageUrl = moviePageUrl(
          "download",
          film.id,
          String(ctx.from.id)
        );

        return await ctx.reply(
          `🎬 ${film.title}\n\n` +
            "Danna maɓallin da ke ƙasa, sannan " +
            "Download Movie domin sauke fim " +
            "zuwa na’urarka.",
          Markup.inlineKeyboard([
            [
              Markup.button.webApp(
                "⬇️ Download Movie",
                downloadPageUrl
              ),
            ],
            [
              Markup.button.callback(
                "⬅️ My Movies",
                "my_movies"
              ),
            ],
          ])
        );
      }

      // =================================
      // OLD TELEGRAM FILE
      // =================================

      if (film.videoFileId) {
        return await sendTelegramMovie(ctx, film);
      }

      return await ctx.reply(
        "❌ Ba a samu video source na wannan film ba."
      );
    } catch (error) {
      logError("DOWNLOAD MOVIE ERROR", error);

      return ctx.reply(
        "❌ An samu kuskure wajen sauke film."
      );
    }
  });
}

// =================================
// BUILD MINI APP URL
// =================================

function moviePageUrl(page, filmId, telegramId) {
  return (
    `${PUBLIC_BASE_URL}/telegram/${page}/${filmId}` +
    `?telegramId=${encodeURIComponent(telegramId)}`
  );
}

// =================================
// VERIFY FILM OWNERSHIP
// =================================

async function getPurchasedFilm(ctx, filmId) {
  if (
    !Number.isSafeInteger(filmId) ||
    filmId <= 0
  ) {
    await ctx.reply(
      "❌ Film ID bai dace ba."
    );

    return null;
  }

  const purchase = await prisma.purchase.findFirst({
    where: {
      telegramId: String(ctx.from.id),
      filmId,
    },
    include: {
      film: true,
    },
  });

  if (!purchase) {
    await ctx.reply(
      "❌ Ba ka mallaki wannan film ba."
    );

    return null;
  }

  if (!purchase.film) {
    await ctx.reply(
      "❌ Ba a samu bayanan wannan film ba."
    );

    return null;
  }

  return purchase.film;
}

// =================================
// SEND EXISTING TELEGRAM FILE
// =================================

async function sendTelegramMovie(ctx, film) {
  const caption =
    `🎬 ${shortenText(film.title, 200)}\n\n` +
    "✅ Ga film ɗinka. Za ka iya kallonsa " +
    "ko sauke shi a Telegram.";

  try {
    return await bot.telegram.sendVideo(
      ctx.chat.id,
      film.videoFileId,
      {
        caption,
        supports_streaming: true,
      }
    );
  } catch (error) {
    logError(
      "SEND TELEGRAM VIDEO ERROR",
      error
    );

    return await bot.telegram.sendDocument(
      ctx.chat.id,
      film.videoFileId,
      {
        caption,
      }
    );
  }
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
      return await replaceOrReply(
        ctx,
        "📂 MY MOVIES\n\n" +
          "Har yanzu ba ka sayi wani film ba.",
        Markup.inlineKeyboard(
          menuButtons()
        )
      );
    }

    const totalPages = Math.max(
      1,
      Math.ceil(
        totalMovies / MOVIES_PER_PAGE
      )
    );

    const normalizedPage = Number.isFinite(
      Number(requestedPage)
    )
      ? Math.trunc(Number(requestedPage))
      : 1;

    const page = Math.min(
      Math.max(normalizedPage, 1),
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

    const validPurchases = purchases.filter(
      (purchase) => purchase.film
    );

    const buttons = validPurchases.map(
      ({ film }) => [
        Markup.button.callback(
          `🎬 ${shortenText(film.title, 40)}`,
          `watch_${film.id}`
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

    buttons.push(...menuButtons());

    const message =
      `🎬 MY MOVIES\n\n` +
      `📄 Page: ${page}/${totalPages}\n` +
      `🎥 Total Movies: ${totalMovies}\n\n` +
      (
        validPurchases.length > 0
          ? "Zaɓi film ɗin da kake son kallo ko saukewa:"
          : "Ba a samu bayanan fina-finai a wannan shafin ba."
      );

    return await replaceOrReply(
      ctx,
      message,
      Markup.inlineKeyboard(buttons)
    );
  } catch (error) {
    logError(
      "SHOW MY MOVIES ERROR",
      error
    );

    return ctx.reply(
      "❌ An samu kuskure wajen ɗauko fina-finanka."
    );
  }
}

// =================================
// MAIN NAVIGATION BUTTONS
// =================================

function menuButtons() {
  return [
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
  ];
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
        return ctx.reply(
          message,
          options
        );
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
  const characters = Array.from(
    String(value || "Untitled movie")
  );

  if (characters.length <= maximumLength) {
    return characters.join("");
  }

  return (
    characters
      .slice(0, maximumLength - 3)
      .join("") + "..."
  );
}

// =================================
// LOG ERRORS WITHOUT FULL REQUEST URLS
// =================================

function logError(label, error) {
  console.error(
    `${label}:`,
    error?.response?.description ||
      error?.code ||
      error?.name ||
      "Unknown error"
  );
}