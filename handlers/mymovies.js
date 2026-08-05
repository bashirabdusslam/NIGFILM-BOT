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
          item.category.trim().length > 0
      );

      if (validCategories.length === 0) {
        return replaceWithText(
          ctx,
          "📭 Har yanzu babu wani film a database.",
          Markup.inlineKeyboard([
            [
              Markup.button.callback(
                "🏠 Main Menu",
                "main_menu"
              ),
            ],
          ])
        );
      }

      const buttons = validCategories.map((item) => [
        Markup.button.callback(
          `📂 ${shortenText(item.category, 40)}`,
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

      return replaceWithText(
        ctx,
        "🎬 *BROWSE FILMS*\n\nZaɓi category ɗin da kake son dubawa:",
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard(buttons),
        }
      );
    } catch (error) {
      console.error("BROWSE FILMS ERROR:", error);

      return showError(
        ctx,
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

      const category = safeDecode(ctx.match[1]);

      const films = await prisma.film.findMany({
        where: {
          category,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      if (films.length === 0) {
        return replaceWithText(
          ctx,
          "❌ Babu wani film a wannan category.",
          Markup.inlineKeyboard([
            [
              Markup.button.callback(
                "⬅️ Categories",
                "browse_films"
              ),
            ],
            [
              Markup.button.callback(
                "🏠 Main Menu",
                "main_menu"
              ),
            ],
          ])
        );
      }

      const buttons = films.map((film) => [
        Markup.button.callback(
          `🎬 ${shortenText(film.title, 40)}`,
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

      return replaceWithText(
        ctx,
        `📂 *${escapeMarkdown(
          category
        )}*\n\nZaɓi film ɗin da kake son dubawa:`,
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard(buttons),
        }
      );
    } catch (error) {
      console.error("CATEGORY FILMS ERROR:", error);

      return showError(
        ctx,
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
        return ctx.answerCbQuery(
          "❌ Film ID bai dace ba.",
          {
            show_alert: true,
          }
        );
      }

      const film = await prisma.film.findUnique({
        where: {
          id: filmId,
        },
      });

      if (!film) {
        return showError(
          ctx,
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
          Markup.button.callback(
            "🛒 Add to Cart",
            `add_to_cart_${film.id}`
          ),
        ],
        [
          Markup.button.callback(
            "⬅️ Back",
            `back_category_${encodeURIComponent(
              film.category
            )}`
          ),
        ],
        [
          Markup.button.callback(
            "🏠 Main Menu",
            "main_menu_from_photo"
          ),
        ],
      ]);

      /*
       * Ana goge tsohon category menu kafin
       * a turo poster. Hakan yana rage tarin saƙonni.
       */
      await ctx.deleteMessage().catch(() => {});

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

      return showError(
        ctx,
        "❌ An samu kuskure wajen buɗe film."
      );
    }
  });

  // =================================
  // BACK FROM FILM TO CATEGORY
  // =================================

  bot.action(
    /^back_category_(.+)$/,
    async (ctx) => {
      try {
        await ctx.answerCbQuery().catch(() => {});

        const category = safeDecode(ctx.match[1]);

        const films = await prisma.film.findMany({
          where: {
            category,
          },
          orderBy: {
            createdAt: "desc",
          },
        });

        const buttons = films.map((film) => [
          Markup.button.callback(
            `🎬 ${shortenText(film.title, 40)}`,
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

        /*
         * Ana goge poster ɗin da aka buɗe,
         * sannan a dawo da jerin films.
         */
        await ctx.deleteMessage().catch(() => {});

        return ctx.reply(
          `📂 *${escapeMarkdown(
            category
          )}*\n\nZaɓi film ɗin da kake son dubawa:`,
          {
            parse_mode: "Markdown",
            ...Markup.inlineKeyboard(buttons),
          }
        );
      } catch (error) {
        console.error(
          "BACK CATEGORY ERROR:",
          error
        );

        return showError(
          ctx,
          "❌ An samu kuskure wajen komawa baya."
        );
      }
    }
  );

  // =================================
  // MAIN MENU FROM PHOTO
  // =================================

  bot.action(
    "main_menu_from_photo",
    async (ctx) => {
      try {
        await ctx.answerCbQuery().catch(() => {});

        await ctx.deleteMessage().catch(() => {});

        return ctx.reply(
          "🏠 *Barka da zuwa NIGFILM BOT*\n\n" +
            "🎬 Sayi fina-finai cikin sauƙi.\n\n" +
            "👇 Zaɓi abin da kake son yi:",
          {
            parse_mode: "Markdown",
            ...mainMenuKeyboard(),
          }
        );
      } catch (error) {
        console.error(
          "MAIN MENU FROM PHOTO ERROR:",
          error
        );

        return showError(
          ctx,
          "❌ An samu kuskure wajen komawa Main Menu."
        );
      }
    }
  );

  // =================================
  // ADD TO CART
  // =================================

  bot.action(
    /^add_to_cart_(\d+)$/,
    async (ctx) => {
      try {
        const telegramId = String(ctx.from.id);
        const filmId = Number(ctx.match[1]);

        if (!Number.isInteger(filmId)) {
          return ctx.answerCbQuery(
            "❌ Film ID bai dace ba.",
            {
              show_alert: true,
            }
          );
        }

        /*
         * Cart yana da relation da User,
         * saboda haka muna tabbatar user yana database.
         */
        await prisma.user.upsert({
          where: {
            telegramId,
          },
          update: {
            firstName: ctx.from.first_name || "",
            lastName: ctx.from.last_name || "",
            username: ctx.from.username || "",
          },
          create: {
            telegramId,
            firstName: ctx.from.first_name || "",
            lastName: ctx.from.last_name || "",
            username: ctx.from.username || "",
          },
        });

        const film = await prisma.film.findUnique({
          where: {
            id: filmId,
          },
        });

        if (!film) {
          return ctx.answerCbQuery(
            "❌ Ba a samu wannan film ba.",
            {
              show_alert: true,
            }
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
          return ctx.answerCbQuery(
            "✅ Ka riga ka sayi wannan film.",
            {
              show_alert: true,
            }
          );
        }

        const existing =
          await prisma.cart.findFirst({
            where: {
              telegramId,
              filmId,
            },
          });

        if (existing) {
          return ctx.answerCbQuery(
            "🛒 Wannan film yana cikin Cart ɗinka.",
            {
              show_alert: false,
            }
          );
        }

        await prisma.cart.create({
          data: {
            telegramId,
            filmId,
          },
        });

        /*
         * Wannan ƙaramin notification ne.
         * Ba zai ƙara sabon message ba.
         */
        return ctx.answerCbQuery(
          `✅ ${shortenText(
            film.title,
            100
          )} an saka cikin Cart.`,
          {
            show_alert: false,
          }
        );
      } catch (error) {
        console.error(
          "ADD TO CART ERROR:",
          error
        );

        return ctx.answerCbQuery(
          "❌ An kasa saka film cikin Cart.",
          {
            show_alert: true,
          }
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
        return replaceWithText(
          ctx,
          "🛒 *MY CART*\n\nCart ɗinka babu komai.",
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

      const total = cartItems.reduce(
        (sum, item) =>
          sum + Number(item.film.price),
        0
      );

      let message = "🛒 *MY CART*\n\n";

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
          "⬅️ Browse Films",
          "browse_films"
        ),
      ]);

      buttons.push([
        Markup.button.callback(
          "🏠 Main Menu",
          "main_menu"
        ),
      ]);

      return replaceWithText(ctx, message, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
    } catch (error) {
      console.error("VIEW CART ERROR:", error);

      return showError(
        ctx,
        "❌ An kasa buɗe Cart."
      );
    }
  });

  // =================================
  // REMOVE ONE FILM FROM CART
  // =================================

  bot.action(
    /^remove_cart_(\d+)$/,
    async (ctx) => {
      try {
        const telegramId = String(ctx.from.id);
        const filmId = Number(ctx.match[1]);

        if (!Number.isInteger(filmId)) {
          return ctx.answerCbQuery(
            "❌ Film ID bai dace ba.",
            {
              show_alert: true,
            }
          );
        }

        const deleted = await prisma.cart.deleteMany({
          where: {
            telegramId,
            filmId,
          },
        });

        if (deleted.count === 0) {
          return ctx.answerCbQuery(
            "ℹ️ Wannan film baya cikin Cart.",
            {
              show_alert: false,
            }
          );
        }

        await ctx.answerCbQuery(
          "✅ An cire film daga Cart."
        ).catch(() => {});

        return showCart(ctx);
      } catch (error) {
        console.error(
          "REMOVE CART ERROR:",
          error
        );

        return ctx.answerCbQuery(
          "❌ An kasa cire film daga Cart.",
          {
            show_alert: true,
          }
        );
      }
    }
  );

  // =================================
  // CLEAR CART
  // =================================

  bot.action("clear_cart", async (ctx) => {
    try {
      const telegramId = String(ctx.from.id);

      const deleted = await prisma.cart.deleteMany({
        where: {
          telegramId,
        },
      });

      await ctx.answerCbQuery(
        deleted.count > 0
          ? "✅ An share Cart."
          : "ℹ️ Cart ɗinka babu komai."
      ).catch(() => {});

      return replaceWithText(
        ctx,
        "🛒 *MY CART*\n\nCart ɗinka babu komai.",
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
    } catch (error) {
      console.error("CLEAR CART ERROR:", error);

      return ctx.answerCbQuery(
        "❌ An kasa share Cart.",
        {
          show_alert: true,
        }
      );
    }
  });

  // =================================
  // SEARCH FILMS BUTTON
  // =================================

  bot.action("search_films", async (ctx) => {
    try {
      await ctx.answerCbQuery().catch(() => {});

      return replaceWithText(
        ctx,
        "🔍 *SEARCH FILMS*\n\n" +
          "Rubuta wannan command:\n\n" +
          "`/search sunan film`\n\n" +
          "Misali:\n" +
          "`/search Labarina`",
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard([
            [
              Markup.button.callback(
                "⬅️ Main Menu",
                "main_menu"
              ),
            ],
          ]),
        }
      );
    } catch (error) {
      console.error(
        "SEARCH FILMS BUTTON ERROR:",
        error
      );

      return showError(
        ctx,
        "❌ An samu kuskure wajen fara search."
      );
    }
  });

  // =================================
  // SEARCH FILMS COMMAND
  // =================================

  bot.command("search", async (ctx) => {
    try {
      const messageText =
        ctx.message?.text || "";

      const query = messageText
        .replace(/^\/search(?:@\w+)?/i, "")
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

      const buttons = films.map((film) => [
        Markup.button.callback(
          `🎬 ${shortenText(film.title, 40)}`,
          `view_film_${film.id}`
        ),
      ]);

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
        `🔍 *SEARCH RESULTS*\n\nAn samu films ${films.length}:`,
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard(buttons),
        }
      );
    } catch (error) {
      console.error(
        "SEARCH COMMAND ERROR:",
        error
      );

      return ctx.reply(
        "❌ An samu kuskure wajen neman film."
      );
    }
  });
}

// =================================
// SHOW CART AFTER REMOVE
// =================================

async function showCart(ctx) {
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
    return replaceWithText(
      ctx,
      "🛒 *MY CART*\n\nCart ɗinka babu komai.",
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

  const total = cartItems.reduce(
    (sum, item) =>
      sum + Number(item.film.price),
    0
  );

  let message = "🛒 *MY CART*\n\n";

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
      "⬅️ Browse Films",
      "browse_films"
    ),
  ]);

  return replaceWithText(ctx, message, {
    parse_mode: "Markdown",
    ...Markup.inlineKeyboard(buttons),
  });
}

// =================================
// MAIN MENU KEYBOARD
// =================================

function mainMenuKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        "🎬 Browse Films",
        "browse_films"
      ),
      Markup.button.callback(
        "🔍 Search Films",
        "search_films"
      ),
    ],
    [
      Markup.button.callback(
        "🛒 My Cart",
        "view_cart"
      ),
      Markup.button.callback(
        "🎥 My Movies",
        "my_purchases"
      ),
    ],
    [
      Markup.button.callback(
        "💬 Support",
        "support"
      ),
    ],
  ]);
}

// =================================
// REPLACE CURRENT MESSAGE WITH TEXT
// =================================

async function replaceWithText(
  ctx,
  message,
  options = {}
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

    /*
     * Idan message ɗin photo ne, ba za a iya
     * editMessageText ba. Sai a goge shi a turo text.
     */
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

// =================================
// ERROR WITHOUT TOO MANY MESSAGES
// =================================

async function showError(ctx, message) {
  try {
    return await replaceWithText(
      ctx,
      message,
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            "🏠 Main Menu",
            "main_menu"
          ),
        ],
      ])
    );
  } catch {
    return ctx.reply(message);
  }
}

// =================================
// SAFE URL DECODE
// =================================

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return String(value || "");
  }
}

// =================================
// ESCAPE MARKDOWN
// =================================

function escapeMarkdown(value) {
  return String(value ?? "").replace(
    /([_*[\]()~`>#+\-=|{}.!])/g,
    "\\$1"
  );
}

// =================================
// SHORTEN BUTTON TEXT
// =================================

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