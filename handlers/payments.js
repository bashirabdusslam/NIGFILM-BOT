import { bot, prisma } from "../bot.js";
import { Markup } from "telegraf";

const PAYSTACK_INITIALIZE_URL =
  "https://api.paystack.co/transaction/initialize";

const PAYMENT_CALLBACK_URL =
  "https://nigfilm-bot.onrender.com/payment-success";

export default function registerPaymentsHandlers() {
  // ===============================
  // BUY NOW
  // ===============================

  bot.action(/^buy_now_(\d+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery().catch(() => {});

      const telegramId = String(ctx.from.id).trim();
      const filmId = Number(ctx.match[1]);

      if (!Number.isInteger(filmId)) {
        return ctx.reply("❌ Film ID bai dace ba.");
      }

      if (!process.env.PAYSTACK_SECRET_KEY) {
        console.error(
          "PAYSTACK_SECRET_KEY is missing."
        );

        return ctx.reply(
          "❌ Payment system bai shirya ba. Tuntuɓi admin."
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

      // Duba ko ya riga ya saya
      const existingPurchase =
        await prisma.purchase.findFirst({
          where: {
            telegramId,
            filmId,
          },
        });

      if (existingPurchase) {
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

      const price = Number(film.price);

      if (!Number.isInteger(price) || price < 0) {
        console.error(
          "Invalid film price:",
          film.id,
          film.price
        );

        return ctx.reply(
          "❌ Farashin wannan film bai dace ba. Tuntuɓi admin."
        );
      }

      const orderReference =
        `NIGFILM_${telegramId}_${filmId}_${Date.now()}`;

      const order = await prisma.order.create({
        data: {
          telegramId,
          filmId,
          amount: price,
          status: "pending",
          paymentReference: orderReference,
        },
      });

      const email =
        `${telegramId}@telegram.nigfilm.com`;

      const paymentResult =
        await initializePaystackPayment({
          email,
          amount: price,
          reference: orderReference,
          metadata: {
            telegramId,
            filmId,
            type: "buy_now",
          },
        });

      if (!paymentResult.status) {
        console.error(
          "PAYSTACK INITIALIZE FAILED:",
          paymentResult
        );

        await prisma.order.deleteMany({
          where: {
            id: order.id,
            status: "pending",
          },
        });

        return ctx.reply(
          "❌ An kasa ƙirƙirar Payment Link. Ka sake gwadawa."
        );
      }

      const paymentLink =
        paymentResult.data.authorization_url;

      return ctx.reply(
        `🎬 *${escapeMarkdown(film.title)}*

💰 Amount: ₦${price.toLocaleString()}

✅ Danna maɓallin da ke ƙasa domin biyan kuɗi ta Paystack.

⚠️ Bayan an tabbatar da biyan kuɗinka, bot zai tura maka film ɗin ta atomatik.`,
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard([
            [
              Markup.button.url(
                `💳 Biya ₦${price.toLocaleString()}`,
                paymentLink
              ),
            ],
            [
              Markup.button.callback(
                "⬅️ Back to Film",
                `view_film_${film.id}`
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
      console.error("BUY NOW ERROR:", error);

      return ctx.reply(
        "❌ An samu kuskure wajen fara biyan kuɗi."
      );
    }
  });

  // ===============================
  // CHECKOUT CART
  // ===============================

  bot.action("checkout_cart", async (ctx) => {
    try {
      await ctx.answerCbQuery().catch(() => {});

      const telegramId = String(ctx.from.id).trim();

      if (!process.env.PAYSTACK_SECRET_KEY) {
        console.error(
          "PAYSTACK_SECRET_KEY is missing."
        );

        return ctx.reply(
          "❌ Payment system bai shirya ba. Tuntuɓi admin."
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

      const cartItems = await prisma.cart.findMany({
        where: {
          telegramId,
        },
        include: {
          film: true,
        },
        orderBy: {
          createdAt: "asc",
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
            ]),
          }
        );
      }

      // Cire films da aka riga aka saya
      const purchases = await prisma.purchase.findMany({
        where: {
          telegramId,
          filmId: {
            in: cartItems.map(
              (item) => item.filmId
            ),
          },
        },
        select: {
          filmId: true,
        },
      });

      const purchasedFilmIds = new Set(
        purchases.map(
          (purchase) => purchase.filmId
        )
      );

      const payableItems = cartItems.filter(
        (item) =>
          !purchasedFilmIds.has(item.filmId)
      );

      if (payableItems.length === 0) {
        await prisma.cart.deleteMany({
          where: {
            telegramId,
          },
        });

        return ctx.reply(
          "✅ Ka riga ka sayi duk fina-finan da ke cikin Cart.",
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

      // Cire purchased films daga cart
      if (purchasedFilmIds.size > 0) {
        await prisma.cart.deleteMany({
          where: {
            telegramId,
            filmId: {
              in: [...purchasedFilmIds],
            },
          },
        });
      }

      const total = payableItems.reduce(
        (sum, item) =>
          sum + Number(item.film.price),
        0
      );

      if (!Number.isInteger(total) || total < 0) {
        return ctx.reply(
          "❌ Total price bai dace ba. Tuntuɓi admin."
        );
      }

      const reference =
        `CART_${telegramId}_${Date.now()}`;

      // Schema na Order yana buƙatar filmId guda ɗaya.
      // Za mu yi amfani da film na farko a matsayin wakilin cart order.
      const representativeFilmId =
        payableItems[0].filmId;

      const order = await prisma.order.create({
        data: {
          telegramId,
          filmId: representativeFilmId,
          amount: total,
          status: "pending",
          paymentReference: reference,
        },
      });

      const email =
        `${telegramId}@telegram.nigfilm.com`;

      const filmIds = payableItems.map(
        (item) => item.filmId
      );

      const paymentResult =
        await initializePaystackPayment({
          email,
          amount: total,
          reference,
          metadata: {
            telegramId,
            type: "cart_checkout",
            filmIds,
          },
        });

      if (!paymentResult.status) {
        console.error(
          "CART PAYSTACK INITIALIZE FAILED:",
          paymentResult
        );

        await prisma.order.deleteMany({
          where: {
            id: order.id,
            status: "pending",
          },
        });

        return ctx.reply(
          "❌ An kasa ƙirƙirar Payment Link. Ka sake gwadawa."
        );
      }

      const paymentLink =
        paymentResult.data.authorization_url;

      return ctx.reply(
        `🛒 *CHECKOUT CART*

🎬 Films: ${payableItems.length}

💰 Total: ₦${total.toLocaleString()}

✅ Danna maɓallin da ke ƙasa domin biyan kuɗi.

⚠️ Bayan an tabbatar da payment, bot zai tura maka duk fina-finan.`,
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard([
            [
              Markup.button.url(
                `💳 Biya ₦${total.toLocaleString()}`,
                paymentLink
              ),
            ],
            [
              Markup.button.callback(
                "⬅️ Back to Cart",
                "view_cart"
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
        "CHECKOUT CART ERROR:",
        error
      );

      return ctx.reply(
        "❌ An samu kuskure wajen Checkout."
      );
    }
  });
}

// ===============================
// PAYSTACK INITIALIZATION HELPER
// ===============================

async function initializePaystackPayment({
  email,
  amount,
  reference,
  metadata,
}) {
  try {
    const response = await fetch(
      PAYSTACK_INITIALIZE_URL,
      {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          amount: amount * 100,
          reference,
          callback_url: PAYMENT_CALLBACK_URL,
          channels: [
            "card",
            "bank",
            "bank_transfer",
            "ussd",
          ],
          metadata,
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      return {
        status: false,
        message:
          result?.message ||
          `Paystack HTTP ${response.status}`,
        data: result?.data,
      };
    }

    return result;
  } catch (error) {
    console.error(
      "PAYSTACK REQUEST ERROR:",
      error
    );

    return {
      status: false,
      message: error.message,
    };
  }
}

// ===============================
// ESCAPE MARKDOWN
// ===============================

function escapeMarkdown(value) {
  return String(value ?? "").replace(
    /([_*[\]()~`>#+\-=|{}.!])/g,
    "\\$1"
  );
}