import { bot, prisma } from "../bot.js";
import { Markup } from "telegraf";

export default function registerBrowseHandlers() {
  // =================================
  // BROWSE FILMS
  // =================================

  bot.action("browse_films", async (ctx) => {
    try {
      await ctx.answerCbQuery().catch(() => {});

      const categories = await prisma.film.findMany({
        distinct: ["category"],
        select: {
          category: true,
        },
        orderBy: {
          category: "asc",
        },
      });

      const validCategories = categories.filter(
        (item) =>
          typeof item.category === "string" &&
          item.category.trim()
      );

      if (validCategories.length === 0) {
        return safeEditOrReply(
          ctx,
          "📭 Har yanzu babu wani film a database.",
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

      const buttons = validCategories.map((item) => [
        Markup.button.callback(
          `📂 ${item.category}`,
          `category_${encodeURIComponent(
            item.category
          )}`
        ),
      ]);

      buttons.push([
        Markup.button.callback(
          "🔍 Search Films",
          "search_films"
        ),
      ]);

      buttons.push([
        Markup.button.callback(
          "🛒 My Cart",
          "view_cart"
        ),
      ]);

      buttons.push([
        Markup.button.callback(
          "🏠 Main Menu",
          "main_menu"
        ),
      ]);

      return safeEditOrReply(
        ctx,
        "🎬 *BROWSE FILMS*\n\nZaɓi category ɗin da kake son dubawa:",
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard(buttons),
        }
      );
    } catch (error) {
      console.error("BROWSE FILMS ERROR:", error);

      return ctx.reply(
        "❌ An samu kuskure wajen buɗe jerin films."
      );
    }
  });

  // =================================
  // CATEGORY FILMS
  // =================================

  bot.action(/^category_(.+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery().catch(() => {});

      const category = decodeURIComponent(
        ctx.match[1]
      );

      const films = await prisma.film.findMany({
        where: {
          category,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      if (films.length === 0) {
        return safeEditOrReply(
          ctx,
          "❌ Babu wani film a wannan category.",
          {
            ...Markup.inlineKeyboard([
              [
                Markup.button.callback(
                  "⬅️ Categories",
                  "browse_films"
                ),
              ],
            ]),
          }
        );
      }

      const buttons = films.map((film) => [
        Markup.button.callback(
          `🎬 ${film.title}`,
          `view_film_${film.id}`
        ),
      ]);

      buttons.push([
        Markup.button.callback(
          "⬅️ Categories",
          "browse_films"
        ),
      ]);

      buttons.push([
        Markup.button.callback(
          "🏠 Main Menu",
          "main_menu"
        ),
      ]);

      return safeEditOrReply(
        ctx,
        `📂 *${escapeMarkdown(category)}*\n\nZaɓi film ɗin da kake son dubawa:`,
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard(buttons),
        }
      );
    } catch (error) {
      console.error("CATEGORY FILMS ERROR:", error);

      return ctx.reply(
        "❌ An samu kuskure wajen ɗauko films."
      );
    }
  });

  // =================================
  // VIEW FILM
  // =================================

  bot.action(/^view_film_(\d+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery().catch(() => {});

      const filmId = Number(ctx.match[1]);

      if (!Number.isInteger(filmId)) {
        return ctx.reply(
          "❌ Film ID bai dace ba."
        );
      }

      const film = await prisma.film.findUnique({
        where: {
          id: filmId,
        },
      });

      if (!film) {
        return ctx.reply(
          "❌ Ba a samu wannan film ba."
        );
      }

      const caption =
        `🎬 *${escapeMarkdown(film.title)}*\n\n` +
        `📝 ${escapeMarkdown(
          film.description
        )}\n\n` +
        `📂 Category: ${escapeMarkdown(
          film.category
        )}\n` +
        `💰 Price: ₦${Number(
          film.price
        ).toLocaleString()}`;

      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback(
            "⚡ Buy Now",
            `buy_now_${film.id}`
          ),
        ],
        [
          Markup.button.callback(
            "🛒 Add to Cart",
            `add_to_cart_${film.id}`
          ),
        ],
        [
          Markup.button.callback(
            "⬅️ Back",
            `category_${encodeURIComponent(
              film.category
            )}`
          ),
        ],
        [
          Markup.button.callback(
            "🏠 Main Menu",
            "main_menu"
          ),
        ],
      ]);

      if (film.posterFileId) {
        return ctx.replyWithPhoto(
          film.posterFileId,
          {
            caption,
            parse_mode: "Markdown",
            ...keyboard,
          }
        );
      }

      return ctx.reply(caption, {
        parse_mode: "Markdown",
        ...keyboard,
      });
    } catch (error) {
      console.error("VIEW FILM ERROR:", error);

      return ctx.reply(
        "❌ An samu kuskure wajen buɗe film."
      );
    }
  });

  // =================================
  // ADD TO CART
  // =================================

  bot.action(
    /^add_to_cart_(\d+)$/,
    async (ctx) => {
      try {
        await ctx.answerCbQuery().catch(() => {});

        const telegramId = String(ctx.from.id);
        const filmId = Number(ctx.match[1]);

        if (!Number.isInteger(filmId)) {
          return ctx.reply(
            "❌ Film ID bai dace ba."
          );
        }

        const film = await prisma.film.findUnique({
          where: {
            id: filmId,
          },
        });

        if (!film) {
          return ctx.reply(
            "❌ Ba a samu wannan film ba."
          );
        }

        const purchased =
          await prisma.purchase.findFirst({
            where: {
              telegramId,
              filmId,
            },
          });

        if (purchased) {
          return ctx.reply(
            "✅ Ka riga ka sayi wannan film.",
            {
              ...Markup.inlineKeyboard([
                [
                  Markup.button.callback(
                    "🎥 My Movies",
                    "my_purchases"
                  ),
                ],
              ]),
            }
          );
        }

        const existing =
          await prisma.cart.findUnique({
            where: {
              telegramId_filmId: {
                telegramId,
                filmId,
              },
            },
          });

        if (existing) {
          return ctx.reply(
            "🛒 Wannan film yana cikin Cart ɗinka.",
            {
              ...Markup.inlineKeyboard([
                [
                  Markup.button.callback(
                    "🛒 View Cart",
                    "view_cart"
                  ),
                ],
              ]),
            }
          );
        }

        await prisma.cart.create({
          data: {
            telegramId,
            filmId,
          },
        });

        return ctx.reply(
          `✅ *${escapeMarkdown(
            film.title
          )}* an saka shi cikin Cart.`,
          {
            parse_mode: "Markdown",
            ...Markup.inlineKeyboard([
              [
                Markup.button.callback(
                  "🛒 View Cart",
                  "view_cart"
                ),
              ],
              [
                Markup.button.callback(
                  "🎬 Continue Browsing",
                  "browse_films"
                ),
              ],
            ]),
          }
        );
      } catch (error) {
        console.error(
          "ADD TO CART ERROR:",
          error
        );

        return ctx.reply(
          "❌ An kasa saka film cikin Cart."
        );
      }
    }
  );

  // =================================
  // VIEW CART
  // =================================

  bot.action("view_cart", async (ctx) => {
    try {
      await ctx.answerCbQuery().catch(() => {});

      const telegramId = String(ctx.from.id);

      const cartItems = await prisma.cart.findMany({
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

      if (cartItems.length === 0) {
        return ctx.reply(
          "🛒 Cart ɗinka babu komai.",
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

      const total = cartItems.reduce(
        (sum, item) =>
          sum + Number(item.film.price),
        0
      );

      let message = "🛒 *YOUR CART*\n\n";

      cartItems.forEach((item, index) => {
        message +=
          `${index + 1}. 🎬 ${escapeMarkdown(
            item.film.title
          )}\n` +
          `💰 ₦${Number(
            item.film.price
          ).toLocaleString()}\n\n`;
      });

      message +=
        "━━━━━━━━━━━━━━\n" +
        `💵 *TOTAL:* ₦${total.toLocaleString()}`;

      const buttons = cartItems.map((item) => [
        Markup.button.callback(
          `❌ Remove ${shortenText(
            item.film.title,
            20
          )}`,
          `remove_cart_${item.filmId}`
        ),
      ]);

      buttons.push([
        Markup.button.callback(
          "💳 Checkout",
          "checkout_cart"
        ),
      ]);

      buttons.push([
        Markup.button.callback(
          "🗑 Clear Cart",
          "clear_cart"
        ),
      ]);

      buttons.push([
        Markup.button.callback(
          "🎬 Continue Browsing",
          "browse_films"
        ),
      ]);

      buttons.push([
        Markup.button.callback(
          "🏠 Main Menu",
          "main_menu"
        ),
      ]);

      return ctx.reply(message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
    } catch (error) {
      console.error("VIEW CART ERROR:", error);

      return ctx.reply(
        "❌ An kasa buɗe Cart."
      );
    }
  });

  // =================================
  // REMOVE ONE CART ITEM
  // =================================

  bot.action(
    /^remove_cart_(\d+)$/,
    async (ctx) => {
      try {
        await ctx.answerCbQuery().catch(() => {});

        const telegramId = String(ctx.from.id);
        const filmId = Number(ctx.match[1]);

        await prisma.cart.deleteMany({
          where: {
            telegramId,
            filmId,
          },
        });

        return ctx.reply(
          "✅ An cire film ɗin daga Cart.",
          {
            ...Markup.inlineKeyboard([
              [
                Markup.button.callback(
                  "🛒 View Cart",
                  "view_cart"
                ),
              ],
            ]),
          }
        );
      } catch (error) {
        console.error(
          "REMOVE CART ITEM ERROR:",
          error
        );

        return ctx.reply(
          "❌ An kasa cire film daga Cart."
        );
      }
    }
  );

  // =================================
  // CLEAR CART
  // =================================

  bot.action("clear_cart", async (ctx) => {
    try {
      await ctx.answerCbQuery().catch(() => {});

      const telegramId = String(ctx.from.id);

      const deleted = await prisma.cart.deleteMany({
        where: {
          telegramId,
        },
      });

      if (deleted.count === 0) {
        return ctx.reply(
          "🛒 Cart ɗinka babu komai."
        );
      }

      return ctx.reply(
        "🗑 An share duk fina-finan da ke cikin Cart ɗinka.",
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
    } catch (error) {
      console.error("CLEAR CART ERROR:", error);

      return ctx.reply(
        "❌ An kasa share Cart."
      );
    }
  });

  // =================================
  // SEARCH FILMS BUTTON
  // =================================

  bot.action("search_films", async (ctx) => {
    try {
      await ctx.answerCbQuery().catch(() => {});

      return ctx.reply(
        "🔍 Domin neman film, rubuta:\n\n" +
          "`/search sunan film`\n\n" +
          "Misali:\n" +
          "`/search Labarina`",
        {
          parse_mode: "Markdown",
        }
      );
    } catch (error) {
      console.error(
        "SEARCH FILMS BUTTON ERROR:",
        error
      );

      return ctx.reply(
        "❌ An samu kuskure wajen fara search."
      );
    }
  });

  // =================================
  // SEARCH FILMS COMMAND
  // =================================

  bot.command("search", async (ctx) => {
    try {
      const text = ctx.message?.text || "";

      const query = text
        .replace(/^\/search(@\w+)?/i, "")
        .trim();

      if (!query) {
        return ctx.reply(
          "🔍 Ka rubuta sunan film bayan `/search`.\n\n" +
            "Misali:\n" +
            "`/search Labarina`",
          {
            parse_mode: "Markdown",
          }
        );
      }

      const films = await prisma.film.findMany({
        where: {
          title: {
            contains: query,
            mode: "insensitive",
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 20,
      });

      if (films.length === 0) {
        return ctx.reply(
          `❌ Ba a samu film mai suna "${query}" ba.`,
          {
            ...Markup.inlineKeyboard([
              [
                Markup.button.callback(
                  "🎬 Browse Films",
                  "browse_films"
                ),
              ],
            ]),
          }
        );
      }

      const buttons = films.map((film) => [
        Markup.button.callback(
          `🎬 ${film.title}`,
          `view_film_${film.id}`
        ),
      ]);

      buttons.push([
        Markup.button.callback(
          "🎬 Browse Films",
          "browse_films"
        ),
      ]);

      return ctx.reply(
        `🔍 *SEARCH RESULTS*\n\nAn samu films ${films.length}:`,
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard(buttons),
        }
      );
    } catch (error) {
      console.error(
        "SEARCH FILMS COMMAND ERROR:",
        error
      );

      return ctx.reply(
        "❌ An samu kuskure wajen neman film."
      );
    }
  });
}

// =================================
// HELPERS
// =================================

async function safeEditOrReply(
  ctx,
  message,
  options
) {
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
        "message to edit not found"
      ) ||
      description.includes(
        "message can't be edited"
      ) ||
      description.includes(
        "there is no text in the message to edit"
      )
    ) {
      return ctx.reply(message, options);
    }

    throw error;
  }
}

function escapeMarkdown(value) {
  return String(value ?? "")
    .replace(/([_*[\]()~`>#+\-=|{}.!])/g, "\\$1");
}

function shortenText(value, maximumLength) {
  const text = String(value ?? "");

  if (text.length <= maximumLength) {
    return text;
  }

  return `${text.slice(
    0,
    maximumLength - 3
  )}...`;
}