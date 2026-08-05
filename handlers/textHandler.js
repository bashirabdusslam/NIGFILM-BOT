import { bot, prisma, ADMIN_ID } from "../bot.js";
import { Markup } from "telegraf";

export default function registerTextHandlers() {
  // =================================
  // TEXT HANDLER
  // =================================

  bot.on("text", async (ctx) => {
    try {
      const telegramId = String(ctx.from.id).trim();
      const text = ctx.message?.text?.trim();

      // Wannan handler na admin ne kawai
      if (telegramId !== String(ADMIN_ID)) {
        return;
      }

      // Kada commands su shiga wizard
      if (!text || text.startsWith("/")) {
        return;
      }

      const session = await prisma.adminSession.findUnique({
        where: {
          telegramId,
        },
      });

      // Idan babu active session, kada a yi komai
      if (!session) {
        return;
      }

      const step = session.step;

      let sessionData = {};

      try {
        sessionData = JSON.parse(session.filmData || "{}");
      } catch {
        sessionData = {};
      }

      // =================================
      // ADD FILM — TITLE
      // =================================

      if (step === "title") {
        sessionData.title = text;

        await prisma.adminSession.update({
          where: {
            telegramId,
          },
          data: {
            step: "description",
            filmData: JSON.stringify(sessionData),
          },
        });

        return ctx.reply(
          "✅ An adana sunan film.\n\n" +
            "Mataki na 2/6\n\n" +
            "📝 Aika description na film ɗin:"
        );
      }

      // =================================
      // ADD FILM — DESCRIPTION
      // =================================

      if (step === "description") {
        sessionData.description = text;

        await prisma.adminSession.update({
          where: {
            telegramId,
          },
          data: {
            step: "price",
            filmData: JSON.stringify(sessionData),
          },
        });

        return ctx.reply(
          "✅ An adana description.\n\n" +
            "Mataki na 3/6\n\n" +
            "💰 Aika farashin film.\n\n" +
            "Misali: 500"
        );
      }

      // =================================
      // ADD FILM — PRICE
      // =================================

      if (step === "price") {
        const price = Number(text.replace(/,/g, ""));

        if (!Number.isInteger(price) || price < 0) {
          return ctx.reply(
            "❌ Farashin bai dace ba.\n\n" +
              "Aika cikakken number kawai.\n" +
              "Misali: 500"
          );
        }

        sessionData.price = price;

        await prisma.adminSession.update({
          where: {
            telegramId,
          },
          data: {
            step: "category",
            filmData: JSON.stringify(sessionData),
          },
        });

        return ctx.reply(
          "✅ An adana farashi.\n\n" +
            "Mataki na 4/6\n\n" +
            "📂 Aika category na film.\n\n" +
            "Misali: Hausa Film"
        );
      }

      // =================================
      // ADD FILM — CATEGORY
      // =================================

      if (step === "category") {
        sessionData.category = text;

        await prisma.adminSession.update({
          where: {
            telegramId,
          },
          data: {
            step: "poster",
            filmData: JSON.stringify(sessionData),
          },
        });

        return ctx.reply(
          "✅ An adana category.\n\n" +
            "Mataki na 5/6\n\n" +
            "🖼️ Yanzu aika POSTER na film ɗin."
        );
      }

      // =================================
      // EDIT TITLE
      // =================================

      if (step === "edit_title") {
        const filmId = Number(sessionData.filmId);

        if (!Number.isInteger(filmId)) {
          await deleteAdminSession(telegramId);

          return ctx.reply(
            "❌ Film ID bai dace ba. Ka sake buɗe Manage Films."
          );
        }

        const film = await prisma.film.update({
          where: {
            id: filmId,
          },
          data: {
            title: text,
          },
        });

        await deleteAdminSession(telegramId);

        return ctx.reply(
          `✅ An canza sunan film cikin nasara.\n\n🎬 ${film.title}`
        );
      }

      // =================================
      // EDIT DESCRIPTION
      // =================================

      if (step === "edit_description") {
        const filmId = Number(sessionData.filmId);

        if (!Number.isInteger(filmId)) {
          await deleteAdminSession(telegramId);

          return ctx.reply(
            "❌ Film ID bai dace ba. Ka sake buɗe Manage Films."
          );
        }

        await prisma.film.update({
          where: {
            id: filmId,
          },
          data: {
            description: text,
          },
        });

        await deleteAdminSession(telegramId);

        return ctx.reply(
          "✅ An canza description na film cikin nasara."
        );
      }

      // =================================
      // EDIT CATEGORY
      // =================================

      if (step === "edit_category") {
        const filmId = Number(sessionData.filmId);

        if (!Number.isInteger(filmId)) {
          await deleteAdminSession(telegramId);

          return ctx.reply(
            "❌ Film ID bai dace ba. Ka sake buɗe Manage Films."
          );
        }

        const film = await prisma.film.update({
          where: {
            id: filmId,
          },
          data: {
            category: text,
          },
        });

        await deleteAdminSession(telegramId);

        return ctx.reply(
          `✅ An canza category cikin nasara.\n\n📂 ${film.category}`
        );
      }

      // =================================
      // EDIT PRICE / CHANGE PRICE
      // =================================

      if (step === "edit_price" || step === "change_price") {
        const filmId = Number(sessionData.filmId);
        const newPrice = Number(text.replace(/,/g, ""));

        if (!Number.isInteger(filmId)) {
          await deleteAdminSession(telegramId);

          return ctx.reply(
            "❌ Film ID bai dace ba. Ka sake buɗe Manage Films."
          );
        }

        if (!Number.isInteger(newPrice) || newPrice < 0) {
          return ctx.reply(
            "❌ Farashin bai dace ba.\n\n" +
              "Aika cikakken number kawai.\n" +
              "Misali: 1000"
          );
        }

        const film = await prisma.film.update({
          where: {
            id: filmId,
          },
          data: {
            price: newPrice,
          },
        });

        await deleteAdminSession(telegramId);

        return ctx.reply(
          `✅ An canza farashin *${film.title}* zuwa ₦${newPrice.toLocaleString()}.`,
          {
            parse_mode: "Markdown",
          }
        );
      }

      // =================================
      // SEARCH USER
      // =================================

      if (step === "search_user") {
        const searchedTelegramId = text.replace(/\s/g, "");
       if (!/^\d+$/.test(searchedTelegramId)) {
  return ctx.reply(
    "❌ Telegram ID bai dace ba.\n\nAika lambobi kawai.\nMisali: 7356306160"
  );
}
        const user = await prisma.user.findUnique({
          where: {
            telegramId: searchedTelegramId,
          },
          include: {
            orders: true,
            purchases: true,
          },
        });

        await deleteAdminSession(telegramId);

        if (!user) {
          return ctx.reply(
            `❌ Ba a samu user mai Telegram ID:\n${searchedTelegramId}`
          );
        }

        const paidOrders = user.orders.filter(
          (order) => order.status === "paid"
        ).length;

        return ctx.reply(
          `👤 *USER DETAILS*

🆔 Telegram ID:
${user.telegramId}

👤 Name:
${`${user.firstName || ""} ${user.lastName || ""}`.trim() || "N/A"}

🔗 Username:
${user.username ? `@${user.username}` : "Babu username"}

🎬 Films Purchased:
${user.purchases.length}

✅ Paid Orders:
${paidOrders}

🛒 Total Orders:
${user.orders.length}

📅 Joined:
${user.createdAt.toLocaleString()}`,
          {
            parse_mode: "Markdown",
            ...Markup.inlineKeyboard([
              [
                Markup.button.callback(
                  "⬅️ Users Dashboard",
                  "admin_users"
                ),
              ],
            ]),
          }
        );
      }

      // =================================
      // BROADCAST
      // =================================

      if (step === "broadcast") {
        const users = await prisma.user.findMany({
          select: {
            telegramId: true,
          },
        });

        if (users.length === 0) {
          await deleteAdminSession(telegramId);

          return ctx.reply("❌ Babu users da za a turawa saƙo.");
        }

        let delivered = 0;
        let failed = 0;

        await ctx.reply(
          `📢 An fara broadcast zuwa users ${users.length}...`
        );

        for (const user of users) {
          try {
            await bot.telegram.sendMessage(
  user.telegramId,
  `📢 SAƘO DAGA NIGFILM BOT\n\n${text}`
);

            delivered += 1;
          } catch (error) {
            failed += 1;

            console.error(
              `BROADCAST FAILED FOR ${user.telegramId}:`,
              error.message
            );
          }

          // Ƙaramin jinkiri don rage Telegram rate-limit
          await delay(100);
        }

        await deleteAdminSession(telegramId);

        return ctx.reply(
          `✅ *BROADCAST YA KAMMALA*

👥 Total Users: ${users.length}

✅ Delivered: ${delivered}

❌ Failed: ${failed}`,
          {
            parse_mode: "Markdown",
          }
        );
      }

      // =================================
      // UNKNOWN SESSION STEP
      // =================================

      console.log("UNKNOWN ADMIN SESSION STEP:", step);

      await deleteAdminSession(telegramId);

      return ctx.reply(
        "⚠️ Wannan admin session ɗin bai dace ba. An soke shi; ka sake fara aikin."
      );
    } catch (error) {
      console.error("TEXT HANDLER ERROR:", error);

      return ctx.reply(
        "❌ An samu kuskure wajen sarrafa saƙonka. Ka sake gwadawa."
      );
    }
  });
}

// =================================
// HELPERS
// =================================

async function deleteAdminSession(telegramId) {
  await prisma.adminSession.deleteMany({
    where: {
      telegramId,
    },
  });
}

function delay(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}