import { bot, prisma } from "../bot.js";
import { Markup } from "telegraf";

export default function registerBrowseHandlers() {

  // Duk Browse handlers za su shiga nan.

}
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

    if (categories.length === 0) {
      return ctx.editMessageText(
        "📭 Har yanzu babu wani film a cikin database."
      );
    }

    const buttons = categories.map((item) => [
      Markup.button.callback(
        `📂 ${item.category}`,
        `category_${item.category}`
      ),
    ]);

    buttons.push([
      Markup.button.callback(
        "🏠 Main Menu",
        "main_menu"
      ),
    ]);

    return ctx.editMessageText(
      "🎬 *Browse Films*\n\nZaɓi category ɗin da kake son dubawa:",
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
// CATEGORY
// =================================

bot.action(/^category_(.+)$/, async (ctx) => {
  try {
    await ctx.answerCbQuery().catch(() => {});

    const category = ctx.match[1];

    const films = await prisma.film.findMany({
      where: {
        category,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (films.length === 0) {
      return ctx.reply("❌ Babu film a wannan category.");
    }

    for (const film of films) {
      await ctx.replyWithPhoto(film.posterFileId, {
        caption:
          `🎬 *${film.title}*\n\n` +
          `💰 ₦${Number(film.price).toLocaleString()}`,

        parse_mode: "Markdown",

        ...Markup.inlineKeyboard([
          [
            Markup.button.callback(
              "🎬 View Film",
              `viewfilm_${film.id}`
            ),
          ],
        ]),
      });
    }

  } catch (error) {
    console.error(error);

    await ctx.reply(
      "❌ An samu kuskure."
    );
  }
});
// =================================
// CATEGORY FILMS
// =================================

bot.action(/^category_(.+)$/, async (ctx) => {
  try {
    await ctx.answerCbQuery().catch(() => {});

    const category = ctx.match[1];

    const films = await prisma.film.findMany({
      where: {
        category,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (films.length === 0) {
      return ctx.editMessageText(
        "❌ Babu wani film a wannan category.",
        {
          ...Markup.inlineKeyboard([
            [
              Markup.button.callback(
                "⬅️ Back",
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

    return ctx.editMessageText(
      `📂 *${category}*\n\nZaɓi film ɗin da kake son dubawa:`,
      {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      }
    );

  } catch (error) {
    console.error("CATEGORY ERROR:", error);

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

    const film = await prisma.film.findUnique({
      where: {
        id: filmId,
      },
    });

    if (!film) {
      return ctx.editMessageText(
        "❌ Ba a samu wannan film ba."
      );
    }

    if (!film.posterFileId) {
      return ctx.reply(
        "❌ Wannan film ba shi da poster."
      );
    }

    await bot.telegram.sendPhoto(
      ctx.chat.id,
      film.posterFileId,
      {
        caption:
          `🎬 *${film.title}*\n\n` +
          `📝 ${film.description}\n\n` +
          `📂 Category: ${film.category}\n` +
          `💰 Price: ₦${Number(film.price).toLocaleString()}`,

        parse_mode: "Markdown",

        ...Markup.inlineKeyboard([
          [
            Markup.button.callback(
              "💳 Buy Now",
              `buy_now_${film.id}`
            ),
          ],
          [
            Markup.button.callback(
              "⬅️ Back",
              `category_${film.category}`
            ),
          ],
        ]),
      }
    );

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

bot.action(/^cart_(\d+)$/, async (ctx) => {
  try {
    await ctx.answerCbQuery().catch(() => {});

    const telegramId = String(ctx.from.id);
    const filmId = Number(ctx.match[1]);

    const film = await prisma.film.findUnique({
      where: {
        id: filmId,
      },
    });

    if (!film) {
      return ctx.reply("❌ Film ba a samu ba.");
    }

    const existing = await prisma.cart.findFirst({
      where: {
        telegramId,
        filmId,
      },
    });

    if (existing) {
      return ctx.reply("🛒 Wannan film yana cikin Cart ɗinka.");
    }

    await prisma.cart.create({
      data: {
        telegramId,
        filmId,
      },
    });

    return ctx.reply(
      `✅ *${film.title}* an saka shi cikin Cart.`,
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
    console.error(error);

    return ctx.reply(
      "❌ An samu kuskure wajen saka film cikin Cart."
    );
  }
});
// =================================
// BUY NOW
// =================================

bot.action(/^buy_now_(\d+)$/, async (ctx) => {
  try {
    await ctx.answerCbQuery().catch(() => {});

    const telegramId = String(ctx.from.id);
    const filmId = Number(ctx.match[1]);

    // Nemo user
    const user = await prisma.user.findUnique({
      where: {
        telegramId,
      },
    });

    if (!user) {
      return ctx.reply(
        "❌ Ba a samu account ɗinka ba."
      );
    }

    if (!user.email) {
      return ctx.reply(
        "❌ Da farko ka saka email ɗinka kafin ka saya."
      );
    }

    // Nemo film
    const film = await prisma.film.findUnique({
      where: {
        id: filmId,
      },
    });

    if (!film) {
      return ctx.reply(
        "❌ Film ba a samu ba."
      );
    }

    const orderReference =
      `NF-${Date.now()}-${telegramId}`;

    // Create pending order
    await prisma.order.create({
      data: {
        telegramId,
        filmId,
        amount: film.price,
        status: "pending",
        paymentReference: orderReference,
      },
    });

    // Create Paystack Payment
    const response = await fetch(
      "https://api.paystack.co/transaction/initialize",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: user.email,
          amount: film.price * 100,
          reference: orderReference,
          callback_url:
            "https://nigfilm-bot.onrender.com/payment-success",

          channels: [
            "card",
            "bank",
            "bank_transfer",
            "ussd",
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

    const paymentLink =
      result.data.authorization_url;

    return ctx.reply(
      `🎬 *${film.title}*

💰 Amount: ₦${Number(
        film.price
      ).toLocaleString()}

✅ Danna link ɗin da ke ƙasa domin biyan kuɗi.

🔗 ${paymentLink}

⚠️ Bayan an tabbatar da biyan kuɗinka, bot zai tura maka film ɗin ta atomatik.`,
      {
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      }
    );

  } catch (error) {
    console.error("BUY NOW ERROR:", error);

    return ctx.reply(
      "❌ An samu kuskure wajen fara biyan kuɗi."
    );
  }
});