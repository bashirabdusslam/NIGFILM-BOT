import { bot, prisma } from "../bot.js";
import { Markup } from "telegraf";

export default function registerStartHandlers() {
  // =================================
  // START COMMAND
  // =================================

  bot.start(async (ctx) => {
    try {
      const telegramId = String(ctx.from.id);
      const payload = ctx.startPayload;

      // Adana ko sabunta user
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

      // =================================
      // FILM DEEP LINK
      // Misali: /start film_12
      // =================================

      if (payload && payload.startsWith("film_")) {
        const filmId = Number(
          payload.replace("film_", "")
        );

        if (!Number.isInteger(filmId)) {
          return ctx.reply(
            "❌ Film link ɗin bai dace ba."
          );
        }

        const film = await prisma.film.findUnique({
          where: {
            id: filmId,
          },
        });

        if (!film) {
          return ctx.reply(
            "❌ Ba a samu wannan film ɗin ba."
          );
        }

        const caption =
          `🎬 *${film.title}*\n\n` +
          `📝 ${film.description}\n\n` +
          `📂 Category: ${film.category}\n` +
          `💰 Farashi: ₦${Number(
            film.price
          ).toLocaleString()}\n\n` +
          "👇 Zaɓi abin da kake son yi:";

        const keyboard = Markup.inlineKeyboard([
          [
            Markup.button.callback(
              "⚡ BUY NOW",
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
      }

      // Idan babu deep link
      return showMainMenu(ctx);
    } catch (error) {
      console.error("START ERROR:", error);

      return ctx.reply(
        "❌ An samu kuskure wajen buɗe bot."
      );
    }
  });

  // =================================
  // MAIN MENU CALLBACK
  // =================================

  bot.action("main_menu", async (ctx) => {
    try {
      await ctx.answerCbQuery().catch(() => {});

      return showMainMenu(ctx);
    } catch (error) {
      console.error("MAIN MENU ERROR:", error);

      return ctx.reply(
        "❌ An samu kuskure wajen buɗe Main Menu."
      );
    }
  });
}

// =================================
// SHOW MAIN MENU
// =================================
async function showMainMenu(ctx) {
  const message =
    "🏠 *Barka da zuwa NIGFILM BOT*\n\n" +
    "🎬 Sayi fina-finai cikin sauƙi.\n\n" +
    "👇 Zaɓi abin da kake son yi:";

  const options = {
    parse_mode: "Markdown",
    ...Markup.inlineKeyboard([
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
    ]),
  };

  if (ctx.callbackQuery?.message) {
    try {
      return await ctx.editMessageText(
        message,
        options
      );
    } catch {
      return ctx.reply(message, options);
    }
  }

  return ctx.reply(message, options);
}