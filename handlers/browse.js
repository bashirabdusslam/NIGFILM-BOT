import { bot, prisma } from "../bot.js";
import { Markup } from "telegraf";

// Ana adana users da suka danna Search Films a nan
const userSearchSessions = new Set();

export default function registerBrowseHandlers() {
  // =================================
  // BROWSE FILMS
  // =================================

  bot.action("browse_films", async (ctx) => {
    try {
      await ctx.answerCbQuery().catch(() => {});

      userSearchSessions.delete(
        String(ctx.from.id)
      );

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
        return replaceCurrentMessage(
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

      return replaceCurrentMessage(
        ctx,
        "🎬 *BROWSE FILMS*\n\nZaɓi category ɗin da kake son dubawa:",
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard(buttons),
        }
      );
    } catch (error) {
      console.error(
        "BROWSE FILMS ERROR:",
        error
      );

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
        return replaceCurrentMessage(
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

      return replaceCurrentMessage(
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
      console.error(
        "CATEGORY FILMS ERROR:",
        error
      );

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
            "main_menu_from_film"
          ),
        ],
      ]);

      // Goge tsohon menu kafin a turo poster
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
      console.error(
        "VIEW FILM ERROR:",
        error
      );

      return ctx.reply(
        "❌ An samu kuskure wajen buɗe film."
      );
    }
  });

  // =================================
  // BACK TO CATEGORY
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
            `🎬 ${shortenText(
              film.title,
              40
            )}`,
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

        return ctx.reply(
          "❌ An samu kuskure wajen komawa category."
        );
      }
    }
  );

  // =================================
  // MAIN MENU FROM FILM
  // =================================

  bot.action(
    "main_menu_from_film",
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
          "MAIN MENU FROM FILM ERROR:",
          error
        );

        return ctx.reply(
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
// ADD TO CART FROM CHANNEL
// =================================

bot.action(
  /^channel_add_cart_(\d+)$/,
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

      // Tabbatar user yana database
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

      // Duba ko user ya riga ya saya
      const purchased =
        await prisma.purchase.findFirst({
          where: {
            telegramId,
            filmId,
          },
        });

      if (purchased) {
        return ctx.answerCbQuery(
          `✅ Ka riga ka sayi ${shortenText(
            film.title,
            120
          )}`,
          {
            show_alert: false,
          }
        );
      }

      // Duba ko yana cart
      const existing =
        await prisma.cart.findFirst({
          where: {
            telegramId,
            filmId,
          },
        });

      if (existing) {
        return ctx.answerCbQuery(
          `🛒 Already added: ${shortenText(
            film.title,
            100
          )}`,
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

      // Wannan shi ne ƙaramin saƙon saman screen
      return ctx.answerCbQuery(
        `✅ Added: ${shortenText(
          film.title,
          120
        )}`,
        {
          show_alert: false,
        }
      );
    } catch (error) {
      console.error(
        "CHANNEL ADD TO CART ERROR:",
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

      return showCart(ctx);
    } catch (error) {
      console.error(
        "VIEW CART ERROR:",
        error
      );

      return showError(
        ctx,
        "❌ An kasa buɗe Cart."
      );
    }
  });

  // =================================
  // REMOVE CART ITEM
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

        await ctx.answerCbQuery(
          deleted.count > 0
            ? "✅ An cire film daga Cart."
            : "ℹ️ Film baya cikin Cart."
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

      return showCart(ctx);
    } catch (error) {
      console.error(
        "CLEAR CART ERROR:",
        error
      );

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

      const telegramId = String(ctx.from.id);

      userSearchSessions.add(telegramId);

      return replaceCurrentMessage(
        ctx,
        `🔍 *SEARCH FILMS*

Yanzu rubuta sunan film ɗin da kake nema.

Misali:
Labarina`,
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard([
            [
              Markup.button.callback(
                "❌ Cancel Search",
                "cancel_film_search"
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
  // CANCEL SEARCH
  // =================================

  bot.action(
    "cancel_film_search",
    async (ctx) => {
      try {
        await ctx.answerCbQuery().catch(() => {});

        userSearchSessions.delete(
          String(ctx.from.id)
        );

        return replaceCurrentMessage(
          ctx,
          "✅ An soke neman film.",
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
        console.error(
          "CANCEL SEARCH ERROR:",
          error
        );

        return ctx.reply(
          "❌ An samu kuskure wajen soke search."
        );
      }
    }
  );

  // =================================
  // RECEIVE FILM SEARCH TEXT
  // =================================

  bot.on("text", async (ctx, next) => {
    try {
      const telegramId = String(ctx.from.id);
      const query = ctx.message?.text?.trim();

      if (!userSearchSessions.has(telegramId)) {
        return next();
      }

      if (!query || query.startsWith("/")) {
        return next();
      }

      userSearchSessions.delete(telegramId);

      // Goge rubutun da user ya aika domin rage cunkoso
      await ctx.deleteMessage().catch(() => {});

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
                  "🔍 Sake Search",
                  "search_films"
                ),
              ],
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
          "🔍 Search Again",
          "search_films"
        ),
      ]);

      buttons.push([
        Markup.button.callback(
          "🏠 Main Menu",
          "main_menu"
        ),
      ]);

      return ctx.reply(
        `🔍 *SEARCH RESULTS*

An samu films ${films.length} masu alaƙa da:

"${escapeMarkdown(query)}"`,
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard(buttons),
        }
      );
    } catch (error) {
      console.error(
        "FILM SEARCH TEXT ERROR:",
        error
      );

      userSearchSessions.delete(
        String(ctx.from.id)
      );

      return ctx.reply(
        "❌ An samu kuskure wajen neman film."
      );
    }
  });

  // =================================
  // OPTIONAL /SEARCH COMMAND
  // =================================

  bot.command("search", async (ctx) => {
    try {
      const messageText =
        ctx.message?.text || "";

      const query = messageText
        .replace(/^\/search(?:@\w+)?/i, "")
        .trim();

      if (!query) {
        userSearchSessions.add(
          String(ctx.from.id)
        );

        return ctx.reply(
          "🔍 Yanzu rubuta sunan film ɗin da kake nema."
        );
      }

      return searchByCommand(ctx, query);
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
// SEARCH USING COMMAND
// =================================

async function searchByCommand(ctx, query) {
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
              "🔍 Sake Search",
              "search_films"
            ),
          ],
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
      `🎬 ${shortenText(film.title, 40)}`,
      `view_film_${film.id}`
    ),
  ]);

  buttons.push([
    Markup.button.callback(
      "🔍 Search Again",
      "search_films"
    ),
  ]);

  buttons.push([
    Markup.button.callback(
      "🏠 Main Menu",
      "main_menu"
    ),
  ]);

  return ctx.reply(
    `🔍 *SEARCH RESULTS*

An samu films ${films.length} masu alaƙa da:

"${escapeMarkdown(query)}"`,
    {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard(buttons),
    }
  );
}

// =================================
// SHOW CART
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
    return replaceCurrentMessage(
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

  return replaceCurrentMessage(ctx, message, {
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
// EDIT CURRENT MESSAGE
// =================================

async function replaceCurrentMessage(
  ctx,
  message,
  options = {}
) {
  if (!ctx.callbackQuery?.message) {
    return ctx.reply(message, options);
  }

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

// =================================
// SHOW ERROR
// =================================

async function showError(ctx, message) {
  try {
    return replaceCurrentMessage(
      ctx,
      message,
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
  } catch {
    return ctx.reply(message);
  }
}

// =================================
// SAFE DECODE
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
// SHORTEN TEXT
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